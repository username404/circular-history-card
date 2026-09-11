/*
 * circular-history-card.js
 *
 * ── UA ───────────────────────────────────────────────────────────────
 * Кругова (полярна) 24-годинна діаграма історії сенсора для Home Assistant.
 * Кілька останніх діб накладаються одна на одну: сьогодні — яскрава лінія,
 * старіші доби — тьмяніші. Дані тягнуться напряму через hass.callApi(),
 * без окремих токенів/скриптів — картка сама себе оновлює.
 *
 * Інтерфейс самої картки (легенда, підписи, редактор) двомовний і
 * перемикається автоматично за мовою профілю HA (hass.language) —
 * окремого параметра в конфізі для цього не потрібно.
 *
 * ПРОДУКТИВНІСТЬ:
 * Сирі дані з HA даунсемплюються в бакети фіксованої роздільної здатності
 * (config.resolution_minutes, за замовч. 2 хв) — тому кількість точок на
 * графіку не залежить від того, як часто сенсор шле нові значення.
 * Даунсемплені точки кешуються в localStorage браузера разом з міткою
 * часу "до якого промальовано" (lastFetch). При кожному оновленні або
 * повторному відкритті сторінки картка запитує в HA лише дельту з моменту
 * lastFetch (а не весь період заново), домальовує кеш і зберігає його
 * назад — тому пробілів після reload сторінки не виникає, а обсяг
 * трафіку й пам'яті лишається малим навіть для дуже "балакучих" сенсорів.
 * Запити до HA також адаптивно дробляться навпіл, якщо шматок не встигає
 * (тайм-аут), і дедублюються між паралельними інстансами картки.
 *
 * ВСТАНОВЛЕННЯ:
 * 1) Скопіюй файл у /config/www/circular-history-card.js
 *    (тека www/ мапиться на /local/ — HA автоматично її роздає)
 * 2) Settings → Dashboards → ... (три крапки) → Resources → Add Resource
 *      URL:  /local/circular-history-card.js
 *      Type: JavaScript Module
 * 3) Онови сторінку (Ctrl+Shift+R), тоді додай картку на дашборд:
 *      Edit Dashboard → Add Card → шукай "Circular History Card"
 *    або вручну через YAML:
 *      type: custom:circular-history-card
 *      entity: sensor.esphome_web_c00230_temperature_aht20
 *      days: 3
 *      title: Температура
 *      color: "#3fa9f5"
 *      refresh_minutes: 5
 *      resolution_minutes: 2
 *      cache: true
 *
 * ── EN ───────────────────────────────────────────────────────────────
 * A circular (polar) 24-hour history chart for Home Assistant. The last
 * N days are overlaid on the same 24h dial: today is a bright line,
 * older days fade out progressively. Data is fetched directly through
 * hass.callApi() — no external tokens or scripts required, the card
 * refreshes itself.
 *
 * The card's own UI (legend, labels, config editor) is bilingual and
 * switches automatically based on the HA profile language
 * (hass.language) — no separate config option needed for this.
 *
 * PERFORMANCE:
 * Raw HA data is downsampled into fixed-resolution buckets
 * (config.resolution_minutes, default 2 min) — so the number of points
 * on the chart doesn't depend on how often the sensor reports new
 * values. Downsampled points are cached in the browser's localStorage
 * together with a "drawn up to" timestamp (lastFetch). On every refresh
 * or page reload the card only requests the delta since lastFetch from
 * HA (not the whole period again), fills in the cache, and saves it
 * back — so there are no gaps after a page reload, and both network
 * traffic and memory usage stay small even for very "chatty" sensors.
 * Requests to HA are also adaptively split in half if a chunk times
 * out, and deduplicated across parallel card instances.
 *
 * INSTALLATION:
 * 1) Copy this file to /config/www/circular-history-card.js
 *    (the www/ folder is served by HA at /local/)
 * 2) Settings → Dashboards → ... (three dots) → Resources → Add Resource
 *      URL:  /local/circular-history-card.js
 *      Type: JavaScript Module
 * 3) Hard-refresh the page (Ctrl+Shift+R), then add the card:
 *      Edit Dashboard → Add Card → search for "Circular History Card"
 *    or manually via YAML:
 *      type: custom:circular-history-card
 *      entity: sensor.your_entity_id
 *      days: 3
 *      title: My Sensor
 *      color: "#3fa9f5"
 *      refresh_minutes: 5
 *      resolution_minutes: 2
 *      cache: true
 */

// -- Локалізація ---------------------------------------------------------
// Мова визначається автоматично з hass.language (мова інтерфейсу HA,
// яку користувач вибирає у своєму профілі) — окремого параметра в
// конфізі картки не потрібно.

const I18N = {
  uk: {
    entityNotFound: (entity) => `Сутність "${entity}" не знайдена`,
    noData: "Немає даних за цей період",
    fetchError: "Не вдалося отримати історію (тайм-аут або помилка, див. консоль)",
    dayToday: "сьогодні",
    dayYesterday: "вчора",
    dayTwoAgo: "позавчора",
    dayNAgo: (n) => `${n} дн. тому`,
    subtitle: (days, unit, pts) => `${days} доби · ${unit} · ${pts} т/добу`,
    entityLabel: "Сенсор (entity)",
    titleLabel: "Назва (необов'язково)",
    titlePlaceholder: "за замовч. — friendly_name",
    daysLabel: "Кількість діб",
    daysHint: "History в HA зазвичай зберігає 10 днів",
    resolutionLabel: "Роздільна здатність, хв",
    ptsPerDay: (n) => `≈ ${n} точок/добу`,
    refreshLabel: "Оновлення картки, хв",
    colorLabel: "Колір лінії",
    cacheLabel: "Кешувати в браузері (localStorage)",
    detailsHint: "Натисни, щоб побачити прямокутний графік",
    rainbowLabel: "Райдужний режим (кожна доба — свій колір)",
  },
  en: {
    entityNotFound: (entity) => `Entity "${entity}" not found`,
    noData: "No data for this period",
    fetchError: "Failed to fetch history (timeout or error, see console)",
    dayToday: "today",
    dayYesterday: "yesterday",
    dayTwoAgo: "2 days ago",
    dayNAgo: (n) => `${n} days ago`,
    subtitle: (days, unit, pts) => `${days}d · ${unit} · ${pts} pts/day`,
    entityLabel: "Sensor (entity)",
    titleLabel: "Title (optional)",
    titlePlaceholder: "defaults to friendly_name",
    daysLabel: "Number of days",
    daysHint: "HA history usually keeps 10 days",
    resolutionLabel: "Resolution, min",
    ptsPerDay: (n) => `≈ ${n} points/day`,
    refreshLabel: "Card refresh, min",
    colorLabel: "Line color",
    cacheLabel: "Cache in browser (localStorage)",
    detailsHint: "Click to see the rectangular chart",
    rainbowLabel: "Rainbow mode (each day its own color)",
  },
};

function pickLang(hass) {
  const raw =
    (hass && (hass.language || (hass.locale && hass.locale.language))) || "en";
  return raw.toLowerCase().startsWith("uk") ? "uk" : "en";
}

function t(hass, key, ...args) {
  const lang = pickLang(hass);
  const dict = I18N[lang] || I18N.en;
  const entry = dict[key] !== undefined ? dict[key] : I18N.en[key];
  return typeof entry === "function" ? entry(...args) : entry;
}

// Глобальний лок між УСІМА інстансами картки (не лише в межах одного).
// Якщо HA з якоїсь причини створить кілька паралельних копій картки для
// одного й того ж сенсора одночасно (напр. відкрив діалог редагування
// картки, поки вона й так вже на дашборді, і клацнув кілька разів) —
// реальний запит до HA піде лише один, решта інстансів просто дочекаються
// його результату й підхоплять спільний кеш замість дублювання запитів.
const GLOBAL_FETCH_LOCKS = new Map(); // cacheKey -> Promise

class CircularHistoryCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      days: 3,
      color: "#3fa9f5",
      refresh_minutes: 5,
      resolution_minutes: 2,
      cache: true,
      rainbow: false,
      ...config,
    };
    if (!this.shadowRoot) {
      this._buildDom();
    }
    this._syncFields();
  }

  set hass(hass) {
    this._hass = hass;
    const picker = this.shadowRoot && this.shadowRoot.querySelector("ha-entity-picker");
    if (picker) picker.hass = hass;
    // мова могла змінитись (або DOM ще не мав перекладених підписів) — оновлюємо текст лейблів
    if (this.shadowRoot) this._syncLabels();
  }

  _pointsPerDayLabel(resolutionMinutes) {
    const r = Math.max(Number(resolutionMinutes) || 1, 1);
    const points = Math.round(1440 / r);
    return t(this._hass, "ptsPerDay", points);
  }

  _row(labelText, inputHtml, hint, hintClass, labelKey, hintKey) {
    return `
      <div class="row">
        <label${labelKey ? ` data-label="${labelKey}"` : ""}>${labelText}</label>
        <div class="control">${inputHtml}</div>
        <div class="hint ${hintClass || ""}"${hintKey ? ` data-hint="${hintKey}"` : ""}>${hint || ""}</div>
      </div>
    `;
  }

  // Будуємо DOM РІВНО ОДИН РАЗ. Наступні виклики setConfig() (які
  // прилітають від HA після кожної зміни в редакторі — це нормальний
  // round-trip) НЕ повинні пересоздавати input-елементи, інакше поле
  // втрачає фокус на кожній набраній букві.
  _buildDom() {
    this.attachShadow({ mode: "open" });
    const c = this._config;
    const hasEntityPicker = !!customElements.get("ha-entity-picker");
    const L = (key, ...args) => t(this._hass, key, ...args);

    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 12px; padding: 8px 2px; }
        .row { display: flex; flex-direction: column; gap: 4px; }
        label {
          font-size: 0.85em;
          color: var(--secondary-text-color);
        }
        input[type="text"], input[type="number"] {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          font-size: 0.95em;
        }
        input[type="color"] {
          width: 48px;
          height: 32px;
          padding: 0;
          border: none;
          background: none;
        }
        .checkbox-row { flex-direction: row; align-items: center; gap: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .hint { font-size: 0.75em; color: var(--secondary-text-color); opacity: 0.8; }
      </style>
      <div class="form">
        ${this._row(
          L("entityLabel"),
          hasEntityPicker
            ? `<ha-entity-picker data-key="entity"></ha-entity-picker>`
            : `<input type="text" data-key="entity" value="${c.entity || ""}" placeholder="sensor.your_entity_id" />`,
          null,
          null,
          "entityLabel"
        )}
        ${this._row(
          L("titleLabel"),
          `<input type="text" data-key="title" value="${c.title || ""}" placeholder="${L("titlePlaceholder")}" />`,
          null,
          null,
          "titleLabel"
        )}
        <div class="grid2">
          ${this._row(
            L("daysLabel"),
            `<input type="number" min="1" max="10" data-key="days" value="${c.days}" />`,
            L("daysHint"),
            null,
            "daysLabel",
            "daysHint"
          )}
          ${this._row(
            L("resolutionLabel"),
            `<input type="number" min="1" max="60" data-key="resolution_minutes" value="${c.resolution_minutes}" />`,
            this._pointsPerDayLabel(c.resolution_minutes),
            "hint-resolution",
            "resolutionLabel"
          )}
        </div>
        <div class="grid2">
          ${this._row(
            L("refreshLabel"),
            `<input type="number" min="1" max="60" data-key="refresh_minutes" value="${c.refresh_minutes}" />`,
            null,
            null,
            "refreshLabel"
          )}
          ${this._row(
            L("colorLabel"),
            `<input type="color" data-key="color" value="${c.color}" />`,
            null,
            null,
            "colorLabel"
          )}
        </div>
        <div class="row checkbox-row">
          <input type="checkbox" id="cache" data-key="cache" ${c.cache ? "checked" : ""} />
          <label for="cache" data-label="cacheLabel">${L("cacheLabel")}</label>
        </div>
        <div class="row checkbox-row">
          <input type="checkbox" id="rainbow" data-key="rainbow" ${c.rainbow ? "checked" : ""} />
          <label for="rainbow" data-label="rainbowLabel">${L("rainbowLabel")}</label>
        </div>
      </div>
    `;

    if (hasEntityPicker) {
      const picker = this.shadowRoot.querySelector("ha-entity-picker");
      if (this._hass) picker.hass = this._hass;
      picker.value = c.entity || ""; // властивість, а не HTML-атрибут — інакше пікер "забуває" значення
      picker.addEventListener("value-changed", (ev) => {
        this._updateConfig("entity", ev.detail.value);
      });
    }

    this.shadowRoot.querySelectorAll("input[data-key]").forEach((el) => {
      const evName = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(evName, () => {
        let value = el.type === "checkbox" ? el.checked : el.value;
        if (el.type === "number") value = value === "" ? "" : Number(value);
        this._updateConfig(el.getAttribute("data-key"), value);
        if (el.getAttribute("data-key") === "resolution_minutes") {
          const hintEl = this.shadowRoot.querySelector(".hint-resolution");
          if (hintEl) hintEl.textContent = this._pointsPerDayLabel(value);
        }
      });
    });
  }

  // Викликається на кожен вхідний setConfig() ПІСЛЯ першої побудови DOM.
  // Оновлює значення полів, але НІКОЛИ не чіпає те поле, яке зараз у
  // фокусі — щоб не зривати курсор/фокус під час набору тексту.
  _syncFields() {
    if (!this.shadowRoot) return;
    const c = this._config;
    const active = this.shadowRoot.activeElement;

    this.shadowRoot.querySelectorAll("input[data-key]").forEach((el) => {
      if (el === active) return; // не чіпаємо поле, куди зараз друкують
      const key = el.getAttribute("data-key");
      const newValue = c[key];
      if (el.type === "checkbox") {
        if (el.checked !== !!newValue) el.checked = !!newValue;
      } else {
        const strNew = newValue === undefined || newValue === null ? "" : String(newValue);
        if (el.value !== strNew) el.value = strNew;
      }
    });

    const picker = this.shadowRoot.querySelector("ha-entity-picker");
    if (picker && picker !== active && picker.value !== (c.entity || "")) {
      picker.value = c.entity || "";
    }

    const hintEl = this.shadowRoot.querySelector(".hint-resolution");
    if (hintEl) hintEl.textContent = this._pointsPerDayLabel(c.resolution_minutes);
  }

  _syncLabels() {
    const L = (key, ...args) => t(this._hass, key, ...args);
    this.shadowRoot.querySelectorAll("[data-label]").forEach((el) => {
      el.textContent = L(el.getAttribute("data-label"));
    });
    const titleInput = this.shadowRoot.querySelector('input[data-key="title"]');
    if (titleInput) titleInput.placeholder = L("titlePlaceholder");
    const daysHintEl = this.shadowRoot.querySelector('[data-hint="daysHint"]');
    if (daysHintEl) daysHintEl.textContent = L("daysHint");
    const hintEl = this.shadowRoot.querySelector(".hint-resolution");
    if (hintEl) hintEl.textContent = this._pointsPerDayLabel(this._config.resolution_minutes);
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("circular-history-card-editor", CircularHistoryCardEditor);

class CircularHistoryCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("circular-history-card-editor");
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("circular-history-card: потрібно вказати 'entity'");
    }
    const newConfig = {
      days: 3,
      color: "#3fa9f5",
      refresh_minutes: 5,
      resolution_minutes: 2,
      cache: true,
      height: 340,
      chunk_hours: 12,
      request_timeout_ms: 25000,
      significant_changes_only: true,
      min_chunk_minutes: 15,
      rainbow: false,
      ...config,
    };

    // Скидаємо кеш/запит лише якщо реально змінились параметри, що
    // впливають на самі дані. Зміна кольору/назви/refresh_minutes під
    // час живого редагування в діалозі картки НЕ повинна форсувати новий
    // фетч — інакше кожна зміна в YAML-редакторі викликає шторм запитів.
    const dataKeys = [
      "entity",
      "days",
      "resolution_minutes",
      "chunk_hours",
      "significant_changes_only",
    ];
    const prev = this.config;
    const dataChanged =
      !prev || dataKeys.some((k) => prev[k] !== newConfig[k]);

    this.config = newConfig;

    if (dataChanged) {
      this._lastFetch = 0;
      this._points = null;
    }

    if (!this.shadowRoot) {
      this._buildDom();
    }
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this.config.entity];
    if (!stateObj) {
      this._renderError(t(hass, "entityNotFound", this.config.entity));
      return;
    }
    this._unit = stateObj.attributes.unit_of_measurement || "";
    this._displayName =
      this.config.title || stateObj.attributes.friendly_name || this.config.entity;

    if (this.shadowRoot) {
      const haCard = this.shadowRoot.querySelector("ha-card");
      if (haCard) {
        const hint = t(hass, "detailsHint");
        haCard.title = hint;
        haCard.setAttribute("aria-label", hint);
      }
    }

    const refreshMs = (this.config.refresh_minutes || 5) * 60000;
    const now = Date.now();
    if (!this._points || now - this._lastFetch > refreshMs) {
      this._lastFetch = now;
      this._fetchHistory();
    } else {
      this._render();
    }
  }

  getCardSize() {
    return 5;
  }

  disconnectedCallback() {
    this._closeDetail();
  }

  static getStubConfig() {
    return { entity: "", days: 3 };
  }

  // -- localStorage кеш -----------------------------------------------

  _cacheKey() {
    return `circular-history-card:${this.config.entity}:${this.config.days}:${this.config.resolution_minutes}`;
  }

  _loadCache() {
    if (!this.config.cache) return null;
    try {
      const raw = window.localStorage.getItem(this._cacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.points) || typeof parsed.lastFetch !== "number") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  _saveCache(points, lastFetchMs) {
    if (!this.config.cache) return;
    try {
      window.localStorage.setItem(
        this._cacheKey(),
        JSON.stringify({ points, lastFetch: lastFetchMs })
      );
    } catch (e) {
      // localStorage недоступний (приватний режим, квота) — просто без кешу
    }
  }

  // -- Даунсемплінг ------------------------------------------------------

  _downsample(rawPoints, resolutionMinutes) {
    const bucketMs = Math.max(resolutionMinutes, 1) * 60000;
    const map = new Map();
    for (const p of rawPoints) {
      const key = Math.floor(p.t / bucketMs) * bucketMs;
      const e = map.get(key);
      if (e) {
        e.sum += p.v;
        e.count += 1;
      } else {
        map.set(key, { sum: p.v, count: 1 });
      }
    }
    const out = [];
    for (const [key, e] of map) {
      out.push({ t: key, v: e.sum / e.count });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  _mergePoints(oldPoints, newPoints) {
    const map = new Map();
    for (const p of oldPoints) map.set(p.t, p.v);
    for (const p of newPoints) map.set(p.t, p.v); // нові перезаписують старі в тих самих бакетах
    const out = Array.from(map.entries()).map(([t, v]) => ({ t, v }));
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  // -- Отримання історії з HA --------------------------------------------

  _withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Тайм-аут запиту (${ms}мс)`)), ms)
      ),
    ]);
  }

  // Ділить [start, end] на послідовні шматки по chunkHours годин, щоб не
  // бити по HA/Recorder одним важким запитом за весь період одразу.
  _splitRange(start, end, chunkHours) {
    const chunkMs = Math.max(chunkHours, 1) * 3600000;
    const chunks = [];
    let cursor = start.getTime();
    const endMs = end.getTime();
    while (cursor < endMs) {
      const chunkEnd = Math.min(cursor + chunkMs, endMs);
      chunks.push([new Date(cursor), new Date(chunkEnd)]);
      cursor = chunkEnd;
    }
    return chunks;
  }

  async _fetchRawHistory(start, end) {
    const entity = this.config.entity;
    const sco = this.config.significant_changes_only ? "&significant_changes_only" : "";
    const path =
      `history/period/${start.toISOString()}` +
      `?filter_entity_id=${entity}` +
      `&end_time=${encodeURIComponent(end.toISOString())}` +
      `&minimal_response&no_attributes${sco}`;
    const data = await this._withTimeout(
      this._hass.callApi("GET", path),
      this.config.request_timeout_ms || 20000
    );
    const series = (data && data[0]) || [];
    return series
      .map((item) => ({
        t: new Date(item.last_changed || item.last_updated).getTime(),
        v: parseFloat(item.state),
      }))
      .filter((p) => !isNaN(p.v) && !isNaN(p.t));
  }

  // Тягне [start, end] по шматках. Якщо конкретний шматок не встиг
  // (тайм-аут/помилка) — ділить його навпіл і пробує знову рекурсивно,
  // аж до мінімального розміру (config.min_chunk_minutes). Так картка
  // сама підлаштовується під "балакучість" сенсора, без ручного підбору
  // chunk_hours: спокійні сенсори йдуть одним запитом на шматок, дуже
  // балакучі — автоматично дробляться дрібніше, поки не влізуть у тайм-аут.
  async _fetchChunkAdaptive(start, end, minChunkMs) {
    const resolution = this.config.resolution_minutes;
    try {
      const raw = await this._fetchRawHistory(start, end);
      return this._downsample(raw, resolution);
    } catch (err) {
      const rangeMs = end.getTime() - start.getTime();
      if (rangeMs <= minChunkMs) {
        console.warn(
          "circular-history-card: пропускаю шматок після повторних невдач",
          start,
          end,
          err
        );
        return [];
      }
      const mid = new Date(start.getTime() + Math.floor(rangeMs / 2));
      // послідовно, а не паралельно — щоб не бомбардувати HA кількома
      // запитами одночасно під час дроблення
      const first = await this._fetchChunkAdaptive(start, mid, minChunkMs);
      const second = await this._fetchChunkAdaptive(mid, end, minChunkMs);
      return first.concat(second);
    }
  }

  async _fetchAllDownsampled(start, end) {
    const chunkHours = this.config.chunk_hours || 12;
    const minChunkMs = (this.config.min_chunk_minutes || 15) * 60000;
    const chunks = this._splitRange(start, end, chunkHours);
    let result = [];
    for (const [cs, ce] of chunks) {
      const down = await this._fetchChunkAdaptive(cs, ce, minChunkMs);
      result = result.concat(down);
    }
    return result;
  }

  async _fetchHistory() {
    if (!this._hass) return;
    if (this._fetchInFlight) return; // не даємо двом запитам бігти в межах ЦЬОГО інстансу

    const key = this._cacheKey();
    const existingLock = GLOBAL_FETCH_LOCKS.get(key);
    if (existingLock) {
      // інший інстанс картки (напр. паралельний діалог редагування) вже
      // тягне ці самі дані — не дублюємо запит, чекаємо на його результат
      try {
        await existingLock;
      } catch (e) {
        // помилка вже залогована тим інстансом, що реально робив запит
      }
      const cachedNow = this._loadCache();
      if (cachedNow && cachedNow.points.length) {
        this._points = cachedNow.points;
        this._render();
      }
      return;
    }

    this._fetchInFlight = true;
    const fetchPromise = this._doFetchHistory();
    GLOBAL_FETCH_LOCKS.set(key, fetchPromise);
    try {
      await fetchPromise;
    } finally {
      this._fetchInFlight = false;
      GLOBAL_FETCH_LOCKS.delete(key);
    }
  }

  async _doFetchHistory() {
    const days = this.config.days;
    const end = new Date();
    const windowStart = new Date(end.getTime() - days * 86400000);

    const cached = this._loadCache();
    let basePoints = [];
    let fetchStart = windowStart;

    if (cached && cached.points.length) {
      // лишаємо тільки те, що ще влазить у вікно днів
      basePoints = cached.points.filter((p) => p.t >= windowStart.getTime());
      // невеликий нахлест 5 хв, щоб не втратити точку на стику
      const overlapMs = 5 * 60000;
      fetchStart = new Date(Math.max(cached.lastFetch - overlapMs, windowStart.getTime()));
    }

    try {
      const newDownsampled = await this._fetchAllDownsampled(fetchStart, end);
      const merged = this._mergePoints(basePoints, newDownsampled).filter(
        (p) => p.t >= windowStart.getTime()
      );

      this._points = merged;
      this._saveCache(merged, end.getTime());
      this._render();
    } catch (err) {
      console.error("circular-history-card: fetch failed", err);
      if (basePoints.length) {
        // якщо є хоч кеш — покажемо його, а не голу помилку
        this._points = basePoints;
        this._render();
      } else {
        this._renderError(t(this._hass, "fetchError"));
      }
    }
  }


  // -- Розкладка по днях ---------------------------------------------------

  _bucketByDay(points, days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {};
    for (let i = 0; i < days; i++) buckets[i] = [];
    points.forEach((p) => {
      const d = new Date(p.t);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const offset = Math.round((today - dayStart) / 86400000);
      if (offset >= 0 && offset < days) {
        const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
        buckets[offset].push({ hour, v: p.v });
      }
    });
    Object.values(buckets).forEach((arr) => arr.sort((a, b) => a.hour - b.hour));
    return buckets;
  }

  _hexToRgb(hex) {
    const m = hex.replace("#", "");
    const bigint = parseInt(
      m.length === 3 ? m.split("").map((c) => c + c).join("") : m,
      16
    );
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }

  // Колір і прозорість лінії для конкретної доби (offset=0 — сьогодні).
  // rainbow: false (за замовч.) — один колір з градацією прозорості, як і
  // раніше. rainbow: true — кожна доба отримує свій відтінок райдуги,
  // щоб дні було легко розрізнити навіть коли лінії сильно накладаються.
  _dayVisual(offset, days) {
    const alpha = Math.max(1 - offset * (0.7 / Math.max(days - 1, 1)), 0.15);
    if (this.config.rainbow) {
      const hue = days > 1 ? (offset / (days - 1)) * 300 : 200;
      return { stroke: `hsl(${hue.toFixed(0)}, 72%, 55%)`, alpha: Math.max(alpha, 0.55) };
    }
    const [r, g, b] = this._hexToRgb(this.config.color);
    return { stroke: `rgb(${r},${g},${b})`, alpha };
  }

  _dayLabel(offset) {
    if (offset === 0) return t(this._hass, "dayToday");
    if (offset === 1) return t(this._hass, "dayYesterday");
    if (offset === 2) return t(this._hass, "dayTwoAgo");
    return t(this._hass, "dayNAgo", offset);
  }

  _render() {
    if (!this.shadowRoot) this._buildDom();
    if (!this._points) return;

    const days = this.config.days;
    const buckets = this._bucketByDay(this._points, days);
    const allVals = Object.values(buckets).flat().map((p) => p.v);

    const titleEl = this.shadowRoot.querySelector(".title");
    const subtitleEl = this.shadowRoot.querySelector(".subtitle");
    const wrapEl = this.shadowRoot.querySelector(".chart-wrap");
    const legendEl = this.shadowRoot.querySelector(".legend");

    const ptsPerDay = Math.round(1440 / Math.max(this.config.resolution_minutes, 1));
    titleEl.textContent = this._displayName;
    subtitleEl.textContent = t(this._hass, "subtitle", days, this._unit, ptsPerDay);

    if (!allVals.length) {
      wrapEl.innerHTML = `<div class="error">${t(this._hass, "noData")}</div>`;
      legendEl.innerHTML = "";
      return;
    }

    const vMin = Math.min(...allVals);
    const vMax = Math.max(...allVals);
    const pad = Math.max((vMax - vMin) * 0.12, 0.5);
    const rMin = vMin - pad;
    const rMax = vMax + pad;

    const size = this.config.height || 340;
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 46;

    const toXY = (hour, v) => {
      const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2; // 0h = top, clockwise
      const radius = ((v - rMin) / (rMax - rMin)) * R;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    };

    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

    // Радіальні кільця (значення)
    const ringCount = 4;
    for (let i = 1; i <= ringCount; i++) {
      const rr = (R / ringCount) * i;
      svg += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="currentColor" stroke-opacity="0.12" />`;
      const val = rMin + ((rMax - rMin) / ringCount) * i;
      svg += `<text x="${cx + 4}" y="${cy - rr - 2}" font-size="9" opacity="0.6">${val.toFixed(1)}</text>`;
    }

    // Годинні промені та підписи
    for (let h = 0; h < 24; h += 3) {
      const angle = (h / 24) * 2 * Math.PI - Math.PI / 2;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.10" />`;
      const lx = cx + (R + 16) * Math.cos(angle);
      const ly = cy + (R + 16) * Math.sin(angle);
      svg += `<text x="${lx}" y="${ly}" font-size="10" text-anchor="middle" dominant-baseline="middle" opacity="0.7">${String(h).padStart(2, "0")}</text>`;
    }

    // Лінії по днях (старіші позаду, тьмяніші, або кожна свого кольору в rainbow-режимі)
    const sortedOffsets = Object.keys(buckets)
      .map(Number)
      .sort((a, b) => b - a);
    for (const offset of sortedOffsets) {
      const pts = buckets[offset];
      if (!pts.length) continue;
      const { stroke, alpha } = this._dayVisual(offset, days);
      const widthPx = offset === 0 ? 2.6 : 1.6;
      const path = pts.map(({ hour, v }) => toXY(hour, v).join(",")).join(" ");
      svg += `<polyline points="${path}" fill="none" stroke="${stroke}" stroke-opacity="${alpha}" stroke-width="${widthPx}" stroke-linejoin="round" stroke-linecap="round" />`;
    }

    // Центральна крапка
    svg += `<circle cx="${cx}" cy="${cy}" r="2" fill="currentColor" opacity="0.3" />`;
    svg += `</svg>`;

    wrapEl.innerHTML = svg;
    wrapEl.style.color = "var(--secondary-text-color)";

    legendEl.innerHTML = sortedOffsets
      .slice()
      .reverse()
      .map((offset) => {
        const { stroke, alpha } = this._dayVisual(offset, days);
        return `<div class="legend-item">
                  <span class="legend-dot" style="background: ${stroke}; opacity: ${alpha}"></span>
                  <span>${this._dayLabel(offset)}</span>
                </div>`;
      })
      .join("");
  }

  // -- Деталізований вигляд (клік по картці) ------------------------------
  // Та сама історія, "розгорнута" з кругової діаграми в звичайний
  // прямокутний XY-графік: вісь X — година доби (0–24), вісь Y —
  // значення. Доби так само накладаються одна на одну з тим самим
  // тьмянінням старіших ліній.

  _openDetail() {
    if (!this._points || !this._points.length) return;
    this._closeDetail(); // про всяк випадок, якщо вже відкрито

    const days = this.config.days;
    const buckets = this._bucketByDay(this._points, days);
    const allVals = Object.values(buckets).flat().map((p) => p.v);
    if (!allVals.length) return;

    const overlay = document.createElement("div");
    overlay.className = "chc-detail-overlay";
    overlay.innerHTML = `
      <style>
        .chc-detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          font-family: var(--paper-font-common-base_-_font-family, sans-serif);
        }
        .chc-detail-panel {
          background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color, #fff);
          border-radius: 12px;
          padding: 20px 24px 16px 24px;
          max-width: 94vw;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .chc-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }
        .chc-detail-title {
          font-size: 1.15em;
          font-weight: 500;
        }
        .chc-detail-close {
          cursor: pointer;
          border: none;
          background: transparent;
          color: var(--secondary-text-color, #aaa);
          font-size: 1.4em;
          line-height: 1;
          padding: 4px 8px;
        }
        .chc-detail-close:hover {
          color: var(--primary-text-color, #fff);
        }
        .chc-detail-legend {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 6px;
          font-size: 0.8em;
          color: var(--secondary-text-color, #aaa);
        }
        .chc-detail-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .chc-detail-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .chc-detail-panel svg text {
          fill: var(--secondary-text-color, #aaa);
        }
      </style>
      <div class="chc-detail-panel" role="dialog" aria-modal="true">
        <div class="chc-detail-header">
          <div class="chc-detail-title">${this._displayName}</div>
          <button class="chc-detail-close" aria-label="Close">✕</button>
        </div>
        <div class="chc-detail-chart"></div>
        <div class="chc-detail-legend"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._detailOverlay = overlay;

    const vMin = Math.min(...allVals);
    const vMax = Math.max(...allVals);
    const pad = Math.max((vMax - vMin) * 0.12, 0.5);

    const chartW = Math.min(Math.round(window.innerWidth * 0.85), 900);
    const chartH = Math.min(Math.round(window.innerHeight * 0.6), 460);

    const { svg, sortedOffsets } = this._renderRectSvg(buckets, vMin - pad, vMax + pad, chartW, chartH);
    overlay.querySelector(".chc-detail-chart").innerHTML = svg;

    overlay.querySelector(".chc-detail-legend").innerHTML = sortedOffsets
      .slice()
      .reverse()
      .map((offset) => {
        const { stroke, alpha } = this._dayVisual(offset, days);
        return `<div class="chc-detail-legend-item">
                  <span class="chc-detail-legend-dot" style="background: ${stroke}; opacity: ${alpha}"></span>
                  <span>${this._dayLabel(offset)}</span>
                </div>`;
      })
      .join("");

    const close = () => this._closeDetail();
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.querySelector(".chc-detail-close").addEventListener("click", close);
    this._detailEscHandler = (ev) => {
      if (ev.key === "Escape") close();
    };
    document.addEventListener("keydown", this._detailEscHandler);
  }

  _closeDetail() {
    if (this._detailOverlay) {
      this._detailOverlay.remove();
      this._detailOverlay = null;
    }
    if (this._detailEscHandler) {
      document.removeEventListener("keydown", this._detailEscHandler);
      this._detailEscHandler = null;
    }
  }

  // Прямокутний XY-варіант того самого накладення діб: вісь X — година
  // (0–24), вісь Y — значення. Повертає {svg, sortedOffsets}.
  _renderRectSvg(buckets, rMin, rMax, width, height) {
    const days = this.config.days;
    const margin = { top: 16, right: 16, bottom: 34, left: 46 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const toXY = (hour, v) => {
      const x = margin.left + (hour / 24) * plotW;
      const y = margin.top + plotH - ((v - rMin) / (rMax - rMin)) * plotH;
      return [x, y];
    };

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Горизонтальні лінії сітки (значення)
    const ringCount = 4;
    for (let i = 0; i <= ringCount; i++) {
      const val = rMin + ((rMax - rMin) / ringCount) * i;
      const y = margin.top + plotH - (i / ringCount) * plotH;
      svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.12" />`;
      svg += `<text x="${margin.left - 8}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle" opacity="0.7">${val.toFixed(1)}</text>`;
    }

    // Вертикальні лінії сітки (години)
    for (let h = 0; h <= 24; h += 3) {
      const x = margin.left + (h / 24) * plotW;
      svg += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}" stroke="currentColor" stroke-opacity="0.10" />`;
      svg += `<text x="${x}" y="${margin.top + plotH + 18}" font-size="10" text-anchor="middle" opacity="0.7">${String(h).padStart(2, "0")}</text>`;
    }

    // Лінії по днях (старіші позаду, тьмяніші, або кожна свого кольору в rainbow-режимі)
    const sortedOffsets = Object.keys(buckets)
      .map(Number)
      .sort((a, b2) => b2 - a);
    for (const offset of sortedOffsets) {
      const pts = buckets[offset];
      if (!pts.length) continue;
      const { stroke, alpha } = this._dayVisual(offset, days);
      const widthPx = offset === 0 ? 2.6 : 1.6;
      const path = pts.map(({ hour, v }) => toXY(hour, v).join(",")).join(" ");
      svg += `<polyline points="${path}" fill="none" stroke="${stroke}" stroke-opacity="${alpha}" stroke-width="${widthPx}" stroke-linejoin="round" stroke-linecap="round" />`;
    }

    svg += `</svg>`;
    return { svg, sortedOffsets };
  }

  _buildDom() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 12px 16px 16px 16px;
          cursor: pointer;
        }
        ha-card:focus-visible {
          outline: 2px solid var(--primary-color);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .title {
          font-size: 1.05em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .subtitle {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }
        .chart-wrap {
          display: flex;
          justify-content: center;
        }
        .legend {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 4px;
          font-size: 0.75em;
          color: var(--secondary-text-color);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .error {
          color: var(--error-color, #e45050);
          font-size: 0.85em;
          padding: 8px 0;
        }
        svg text {
          fill: var(--secondary-text-color);
          font-family: var(--paper-font-common-base_-_font-family, sans-serif);
        }
      </style>
      <ha-card tabindex="0" role="button">
        <div class="header">
          <div class="title"></div>
          <div class="subtitle"></div>
        </div>
        <div class="chart-wrap"></div>
        <div class="legend"></div>
      </ha-card>
    `;

    const haCard = this.shadowRoot.querySelector("ha-card");
    const openIfNotSelecting = () => {
      // не відкриваємо деталі, якщо користувач саме виділяв текст (напр.
      // значення на осях) — клік по виділенню не повинен тригерити модалку
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
      this._openDetail();
    };
    haCard.addEventListener("click", openIfNotSelecting);
    haCard.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._openDetail();
      }
    });
    haCard.title = t(this._hass, "detailsHint");
    haCard.setAttribute("aria-label", t(this._hass, "detailsHint"));
  }

  _renderError(msg) {
    if (!this.shadowRoot) this._buildDom();
    this.shadowRoot.querySelector(".chart-wrap").innerHTML =
      `<div class="error">${msg}</div>`;
  }
}

customElements.define("circular-history-card", CircularHistoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "circular-history-card",
  name: "Circular History Card",
  description: "24-hour polar history chart with day-over-day fading",
});


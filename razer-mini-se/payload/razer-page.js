const device=window.One4AllDeviceClient.razer(window.driveCenterLab);
const colorOptions = [
  { id: 'razer-black', label: '黑色', swatch: '#16181D' },
  { id: 'razer-white', label: '白色', swatch: '#F2F2F2' },
];
const categories = [
  {
    id: 'device',
    label: '设备配置',
    icon: 'icon-a-commonsettings_linear',
    tabs: [
      { id: 'overview', label: '概览', icon: 'icon-a-commonsettings_linear' },
      { id: 'power', label: '电源', icon: 'icon-a-elec100_linear' },
    ],
  },
  {
    id: 'performance',
    label: '性能设置',
    icon: 'icon-setup_linear',
    tabs: [
      { id: 'sensitivity', label: '灵敏度', icon: 'icon-setup_linear' },
      { id: 'polling', label: '回报率', icon: 'icon-refresh_linear' },
    ],
  },
  {
    id: 'other',
    label: '其他设置',
    icon: 'icon-setup2_linear',
    tabs: [
      { id: 'info', label: '设备信息', icon: 'icon-setup2_linear' },
    ],
  },
];

let data = null;
let activeCategory = 'device';
let activeTab = 'overview';
let feedback = '';
let selectedColor = readColor();

const $ = id => document.getElementById(id);

function readColor() {
  const query = new URLSearchParams(location.search).get('color');
  if (colorOptions.some(option => option.id === query)) return query;
  try {
    const saved = localStorage.getItem('dc-razer-color');
    if (colorOptions.some(option => option.id === saved)) return saved;
  } catch {}
  return 'razer-black';
}

function applyColor(color) {
  if (!colorOptions.some(option => option.id === color)) return;
  selectedColor = color;
  try { localStorage.setItem('dc-razer-color', color); } catch {}
  document.querySelectorAll('[data-product-image]').forEach(image => {
    image.src = `product-assets/${color}.webp`;
  });
}

function renderCategoryNav() {
  const nav = $('categoryNav');
  nav.replaceChildren();
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dc-nav-item';
    button.innerHTML = `<i class="dc-nav-icon iconfont ${category.icon}"></i><span class="dc-nav-label">${category.label}</span>`;
    button.classList.toggle('active', category.id === activeCategory);
    button.addEventListener('click', () => {
      activeCategory = category.id;
      activeTab = category.tabs[0].id;
      renderCategoryNav();
      renderTabs();
      renderContent();
    });
    nav.append(button);
  });
}

function renderTabs() {
  const category = categories.find(item => item.id === activeCategory);
  const menu = $('tabMenu');
  menu.replaceChildren();
  category.tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dc-tab';
    button.setAttribute('role', 'tab');
    button.innerHTML = `<i class="iconfont ${tab.icon}"></i><span>${tab.label}</span>`;
    button.classList.toggle('active', tab.id === activeTab);
    button.addEventListener('click', () => {
      activeTab = tab.id;
      feedback = '';
      renderTabs();
      renderContent();
    });
    menu.append(button);
  });
}

const {row,card,segmented}=window.One4AllUI;

function renderMeta() {
  const battery = Number(data?.battery_percent);
  const batteryText = Number.isFinite(battery) ? `${Math.round(battery)}%` : '--%';
  $('batteryText').textContent = batteryText;
  $('connectionText').textContent = data?.poll_rate != null ? '2.4G' : '未连接';
  $('batteryIcon').className = `iconfont icon-a-elec${Math.max(10, Math.min(100, Math.round((Number.isFinite(battery) ? battery : 0) / 10) * 10))}_linear`;
}

function renderContent() {
  const host = $('configArea');
  host.replaceChildren();
  renderMeta();
  const battery = Number(data?.battery_percent);
  const batteryText = Number.isFinite(battery) ? `${Math.round(battery)}%` : '--%';
  const charging = data?.charging === true ? '正在充电' : data?.charging === false ? '电池供电' : '未知';
  const stages = Array.isArray(data?.dpi_stages) ? data.dpi_stages : [];
  const rates = Array.isArray(data?.supported_poll_rates) ? data.supported_poll_rates : [];
  const activeStage = Number(data?.active_stage) || 0;
  const dpi = Array.isArray(data?.dpi) ? data.dpi[0] : null;

  if (activeTab === 'overview') {
    const status = card('设备状态');
    status.append(
      row('电量', batteryText),
      row('连接', data?.poll_rate != null ? '2.4G 无线' : '未连接'),
      row('充电', charging),
      row('当前 DPI', dpi == null ? '--' : `${dpi}`),
      row('当前回报率', data?.poll_rate == null ? '--' : `${data.poll_rate} Hz`)
    );
    const profile = card('设备档位');
    profile.append(
      row('当前档位', activeStage ? `第 ${activeStage} 档` : '--'),
      row('DPI 档位', stages.length ? `${stages.length} 档` : '--'),
      row('回报率档位', rates.length ? `${rates.length} 档` : '--')
    );
    host.append(status, profile);
  }

  if (activeTab === 'sensitivity') {
    const dpiCard = card('DPI 档位');
    const current = document.createElement('div');
    current.className = 'dc-row';
    current.innerHTML = `<span class="dc-muted">当前灵敏度</span><span class="dc-value">${dpi == null ? '--' : dpi}</span>`;
    const stageButtons = segmented(
      stages.map((_, index) => index + 1),
      activeStage,
      value => `${stages[value - 1]?.[0] ?? '--'} DPI`,
      value => applyDpiStage(value)
    );
    dpiCard.append(current, stageButtons);
    if (feedback) {
      const note = document.createElement('div');
      note.className = 'dc-row dc-muted';
      note.textContent = feedback;
      dpiCard.append(note);
    }
    host.append(dpiCard);
  }

  if (activeTab === 'polling') {
    const pollCard = card('回报率');
    const current = document.createElement('div');
    current.className = 'dc-row';
    current.innerHTML = `<span class="dc-muted">当前回报率</span><span class="dc-value">${data?.poll_rate == null ? '--' : data.poll_rate}</span>`;
    const rateButtons = segmented(
      rates,
      Number(data?.poll_rate),
      value => `${value} Hz`,
      value => applyPollRate(value)
    );
    pollCard.append(current, rateButtons);
    if (feedback) {
      const note = document.createElement('div');
      note.className = 'dc-row dc-muted';
      note.textContent = feedback;
      pollCard.append(note);
    }
    host.append(pollCard);
  }

  if (activeTab === 'power') {
    const powerCard = card('电源');
    powerCard.append(row('电池电量', batteryText), row('充电状态', charging));
    host.append(powerCard);
  }

  if (activeTab === 'info') {
    const infoCard = card('设备信息');
    infoCard.append(
      row('设备名称', data?.name || '--'),
      row('设备标识', `${data?.vendor_id || '1532'}:${data?.product_id || '009F'}`),
      row('设备类型', data?.device_type || 'mouse'),
      row('最大 DPI', data?.dpi_max ? `${data.dpi_max} DPI` : '--'),
      row('DPI 档位', stages.length ? stages.map(stage => `${stage[0]}`).join(' / ') : '--'),
      row('回报率', rates.length ? rates.map(rate => `${rate} Hz`).join(' / ') : '--'),
      row('后端', 'openrazer-win')
    );
    host.append(infoCard);
  }
}

async function applyDpiStage(stage) {
  feedback = '正在应用灵敏度…';
  renderContent();
  try {
    data = await device.setDpiStage(stage);
    feedback = `已切换到 ${data?.dpi?.[0] ?? '--'} DPI。`;
  } catch (error) {
    feedback = `应用失败：${error.message}`;
  }
  renderContent();
}

async function applyPollRate(rate) {
  feedback = '正在应用回报率…';
  renderContent();
  try {
    data = await device.setPollRate(rate);
    feedback = `已确认 ${data?.poll_rate ?? '--'} Hz。`;
  } catch (error) {
    feedback = `应用失败：${error.message}`;
  }
  renderContent();
}

async function refresh() {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      data = await Promise.race([
        device.status(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('设备状态读取超时')), 4000)),
      ]);
      if (Array.isArray(data.dpi_stages) && data.dpi_stages.length &&
          Array.isArray(data.supported_poll_rates) && data.supported_poll_rates.length) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  if (!data) {
    const host = $('configArea');
    host.replaceChildren();
    const errorCard = card('读取失败');
    const note = document.createElement('div');
    note.className = 'dc-row dc-muted';
    note.textContent = lastError?.message || '设备状态暂不可用';
    errorCard.append(note);
    host.append(errorCard);
  } else {
    renderContent();
  }
}

applyColor(selectedColor);
$('backHome').addEventListener('click', () => device.back());
renderCategoryNav();
renderTabs();
renderContent();
refresh();

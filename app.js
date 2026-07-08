/* ----------------------------------------------------
 * Core JavaScript Logic for Price & RM Price Checker
 * Designed by Ant for P'Ton
 * ---------------------------------------------------- */

// --- STATE MANAGEMENT ---
let inventoryData = [];
let currentScanner = null;
let selectedCameraId = null;
let currentTab = 'scanner';
let config = {
  mode: 'gas', // 'gas' หรือ 'public'
  gasUrl: 'https://script.google.com/macros/s/AKfycbx_T5kKSpD0i_z1_N13m543v_example/exec', // ตัวอย่าง URL
  sheetId: '1Aq1ZvwqKVKDQGIynEILrFIEe6A-sUqFk9Ztxm6SrNPo'
};

// --- DOM ELEMENTS ---
const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  btnSettings: document.getElementById('btnSettings'),
  settingsModal: document.getElementById('settingsModal'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  modeGas: document.getElementById('modeGas'),
  modePublic: document.getElementById('modePublic'),
  gasInputGroup: document.getElementById('gasInputGroup'),
  publicInputGroup: document.getElementById('publicInputGroup'),
  gasUrlInput: document.getElementById('gasUrlInput'),
  sheetIdInput: document.getElementById('sheetIdInput'),
  
  tabScanner: document.getElementById('tabScanner'),
  tabSearch: document.getElementById('tabSearch'),
  panelScanner: document.getElementById('panelScanner'),
  panelSearch: document.getElementById('panelSearch'),
  
  scannerWrapper: document.getElementById('scannerWrapper'),
  scannerPlaceholder: document.getElementById('scannerPlaceholder'),
  scannerOverlay: document.getElementById('scannerOverlay'),
  cameraSelectContainer: document.getElementById('cameraSelectContainer'),
  cameraSelect: document.getElementById('cameraSelect'),
  btnStartScan: document.getElementById('btnStartScan'),
  btnStopScan: document.getElementById('btnStopScan'),
  
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  suggestionsList: document.getElementById('suggestionsList'),
  
  productDetailCard: document.getElementById('productDetailCard'),
  emptyState: document.getElementById('emptyState'),
  
  detailItem: document.getElementById('detailItem'),
  detailModel: document.getElementById('detailModel'),
  detailDrawing: document.getElementById('detailDrawing'),
  detailName: document.getElementById('detailName'),
  detailPrice: document.getElementById('detailPrice'),
  detailRmPrice: document.getElementById('detailRmPrice'),
  detailMarginCard: document.getElementById('detailMarginCard'),
  detailMarginValue: document.getElementById('detailMarginValue'),
  detailMarginBar: document.getElementById('detailMarginBar')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. โหลดข้อมูลการตั้งค่าจาก LocalStorage
  loadConfig();
  
  // 2. แสดงไอคอนจาก Lucide
  lucide.createIcons();
  
  // 3. โหลดข้อมูลสินค้าจาก Cache (LocalStorage)
  loadCachedData();
  
  // 4. ตั้งค่า Event Listeners
  setupEventListeners();
  
  // 5. ดึงข้อมูลล่าสุดจาก Google Sheets (เบื้องหลัง)
  syncData(false);
});

// --- SETTINGS CONFIGURATION ---
function loadConfig() {
  const savedConfig = localStorage.getItem('price_checker_config');
  if (savedConfig) {
    try {
      config = JSON.parse(savedConfig);
    } catch (e) {
      console.error("โหลดการตั้งค่าล้มเหลว:", e);
    }
  }
  
  // อัปเดตข้อมูลลงในช่องกรอกของหน้าตั้งค่า
  elements.gasUrlInput.value = config.gasUrl || '';
  elements.sheetIdInput.value = config.sheetId || '';
  updateConfigUI();
}

function saveConfig() {
  config.gasUrl = elements.gasUrlInput.value.trim();
  config.sheetId = elements.sheetIdInput.value.trim();
  
  localStorage.setItem('price_checker_config', JSON.stringify(config));
  toggleSettingsModal(false);
  
  // ดึงข้อมูลใหม่ทันทีหลังบันทึก
  syncData(true);
}

function updateConfigUI() {
  if (config.mode === 'gas') {
    elements.modeGas.className = "py-1.5 rounded text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shadow-sm w-full";
    elements.modePublic.className = "py-1.5 rounded text-[11px] font-medium text-gray-500 hover:text-white w-full";
    elements.gasInputGroup.classList.remove('hidden');
    elements.publicInputGroup.classList.add('hidden');
  } else {
    elements.modeGas.className = "py-1.5 rounded text-[11px] font-medium text-gray-500 hover:text-white w-full";
    elements.modePublic.className = "py-1.5 rounded text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shadow-sm w-full";
    elements.gasInputGroup.classList.add('hidden');
    elements.publicInputGroup.classList.remove('hidden');
  }
}

function setConnectionMode(mode) {
  config.mode = mode;
  updateConfigUI();
}

function toggleSettingsModal(show) {
  if (show) {
    elements.settingsModal.classList.remove('hidden');
    // โฟกัสค่าล่าสุด
    elements.gasUrlInput.value = config.gasUrl || '';
    elements.sheetIdInput.value = config.sheetId || '';
  } else {
    elements.settingsModal.classList.add('hidden');
  }
}

// --- SYNC GOOGLE SHEETS DATA ---
async function syncData(forceAlert = false) {
  updateStatusUI('loading', 'กำลังเชื่อมต่อ...');
  
  try {
    let rawData = [];
    
    if (config.mode === 'gas') {
      // ดึงข้อมูลผ่าน Google Apps Script API Web App
      if (!config.gasUrl || config.gasUrl.includes('example')) {
        throw new Error('กรุณากรอก URL ของ Apps Script ก่อนนะคะ');
      }
      
      const response = await fetch(config.gasUrl);
      if (!response.ok) throw new Error('การเชื่อมต่อฝั่งเซิร์ฟเวอร์ขัดข้อง');
      
      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'ดึงข้อมูลไม่สำเร็จ');
      }
      rawData = result.data;
      
    } else {
      // ดึงข้อมูลผ่าน Google Sheet Public (Visualization API)
      if (!config.sheetId) {
        throw new Error('กรุณาระบุ Google Sheet ID ก่อนนะคะ');
      }
      
      const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:json&sheet=price`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('กรุณาตั้งค่าแชร์ชีตเป็นสาธารณะ (ทุกคนที่มีลิงก์ดูได้)');
      
      const text = await response.text();
      // ลบ Query Wrapper ออกเพื่อให้ได้ JSON ที่ถูกต้อง
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1) {
        throw new Error('โครงสร้างข้อมูล Google Sheet ไม่ถูกต้อง');
      }
      
      const jsonStr = text.substring(startIdx, endIdx + 1);
      const json = JSON.parse(jsonStr);
      rawData = parseGoogleSheetJson(json);
    }
    
    // สำเร็จ! จัดเก็บข้อมูลลง Cache
    inventoryData = rawData;
    localStorage.setItem('price_checker_data', JSON.stringify(inventoryData));
    localStorage.setItem('price_checker_last_sync', new Date().toISOString());
    
    updateStatusUI('online', 'ออนไลน์ (ดึงข้อมูลล่าสุดแล้ว)');
    if (forceAlert) {
      alert(`ดึงข้อมูลสำเร็จ! พบรายการสินค้าทั้งหมด ${inventoryData.length} รายการค่ะ 🎉`);
    }
    
  } catch (error) {
    console.error("Sync data error:", error);
    
    // โหลดข้อมูลเก่าจาก Cache มาประคองแทน
    const cached = localStorage.getItem('price_checker_data');
    if (cached) {
      inventoryData = JSON.parse(cached);
      updateStatusUI('offline', 'ออฟไลน์ (ใช้ข้อมูลในเครื่อง)');
      if (forceAlert) {
        alert(`ดึงข้อมูลใหม่ไม่สำเร็จ เนื่องจาก: ${error.message}\nระบบจึงต้องใช้ข้อมูลเดิมที่มีในเครื่องชั่วคราวค่ะ`);
      }
    } else {
      updateStatusUI('offline', 'ไม่พบข้อมูล');
      if (forceAlert) {
        alert(`เกิดข้อผิดพลาด: ${error.message}\nกรุณาตั้งค่าแหล่งข้อมูลและเชื่อมต่อใหม่อีกครั้งค่ะ`);
      }
    }
  }
}

// ฟังก์ชันแปลงรูปแบบ JSON ของ Google Sheet Visualization API
function parseGoogleSheetJson(json) {
  const table = json.table;
  if (!table || !table.cols || !table.rows) return [];
  
  // หาหัวตาราง
  const cols = table.cols.map(c => (c.label || '').trim().toUpperCase());
  const idxItem = cols.indexOf('ITEM');
  const idxName = cols.indexOf('NAME PART');
  const idxModel = cols.indexOf('MODEL');
  const idxDrawing = cols.indexOf('DRAWING');
  const idxPrice = cols.indexOf('PRICE');
  const idxRmPrice = cols.indexOf('RM PRICE');
  
  if (idxItem === -1) {
    throw new Error('ไม่พบคอลัมน์ชื่อ "ITEM" ในหน้าชีต "price" ค่ะ');
  }
  
  const parsedRows = [];
  
  table.rows.forEach(row => {
    const cells = row.c;
    if (!cells || !cells[idxItem]) return;
    
    const itemCode = getCellValue(cells[idxItem]);
    if (!itemCode) return; // ข้ามถ้ารหัสว่างเปล่า
    
    const nameVal = idxName !== -1 ? getCellValue(cells[idxName]) : '';
    const modelVal = idxModel !== -1 ? getCellValue(cells[idxModel]) : '';
    const drawingVal = idxDrawing !== -1 ? getCellValue(cells[idxDrawing]) : '';
    
    // จัดการราคาขาย
    const priceVal = idxPrice !== -1 ? getCellValue(cells[idxPrice]) : null;
    const price = cleanPrice(priceVal);
    
    // จัดการราคาวัตถุดิบ
    const rmPriceVal = idxRmPrice !== -1 ? getCellValue(cells[idxRmPrice]) : null;
    const rmPrice = cleanPrice(rmPriceVal);
    
    parsedRows.push({
      item: String(itemCode).trim(),
      name: String(nameVal).trim(),
      model: String(modelVal).trim(),
      drawing: String(drawingVal).trim(),
      price: price,
      rm_price: rmPrice
    });
  });
  
  return parsedRows;
}

function getCellValue(cell) {
  if (!cell) return '';
  return cell.v !== undefined && cell.v !== null ? cell.v : '';
}

function cleanPrice(val) {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const num = Number(val);
  return isNaN(num) ? String(val).trim() : num;
}

function loadCachedData() {
  const cached = localStorage.getItem('price_checker_data');
  const lastSync = localStorage.getItem('price_checker_last_sync');
  
  if (cached) {
    inventoryData = JSON.parse(cached);
    const syncTimeStr = lastSync ? new Date(lastSync).toLocaleTimeString('th-TH') : 'ไม่ระบุ';
    updateStatusUI('offline', `ออฟไลน์ (อัปเดตเมื่อ ${syncTimeStr})`);
  } else {
    updateStatusUI('offline', 'ไม่มีข้อมูลในเครื่อง');
  }
}

function updateStatusUI(status, text) {
  elements.statusIndicator.className = 'pulse-indicator ' + status;
  elements.statusText.textContent = text;
  
  if (status === 'online') {
    elements.statusText.className = "text-emerald-400 text-[10px]";
  } else if (status === 'offline') {
    elements.statusText.className = "text-amber-400 text-[10px]";
  } else {
    elements.statusText.className = "text-cyan-400 text-[10px]";
  }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // บันทึกการตั้งค่า
  elements.btnSaveSettings.addEventListener('click', saveConfig);
  
  // เปิด/ปิด Modal
  elements.btnSettings.addEventListener('click', () => toggleSettingsModal(true));
  
  // เปิดกล้องสแกน
  elements.btnStartScan.addEventListener('click', startScanning);
  elements.btnStopScan.addEventListener('click', stopScanning);
  
  // ปุ่มเปลี่ยนกล้อง (เมื่อมีตัวเลือก)
  elements.cameraSelect.addEventListener('change', (e) => {
    selectedCameraId = e.target.value;
    if (currentScanner && currentScanner.isScanning) {
      // ถ้ากำลังสแกนอยู่ ให้หยุดแล้วเริ่มใหม่ด้วยกล้องใหม่
      restartScanner();
    }
  });
  
  // ค้นหาข้อมูลแบบกรอกเอง
  elements.searchInput.addEventListener('input', handleSearchInput);
  
  // ล้างคำค้นหา
  elements.btnClearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.btnClearSearch.classList.add('hidden');
    elements.suggestionsList.classList.add('hidden');
    elements.searchInput.focus();
  });
  
  // ซ่อนลิสต์แนะนำเมื่อคลิกนอกช่องค้นหา
  document.addEventListener('click', (e) => {
    if (!elements.searchInput.contains(e.target) && !elements.suggestionsList.contains(e.target)) {
      elements.suggestionsList.classList.add('hidden');
    }
  });
}

// --- TAB SWITCHER ---
function switchTab(tab) {
  currentTab = tab;
  
  // หยุดกล้องสแกนทันทีเมื่อย้ายไปแถบค้นหา
  if (tab === 'search' && currentScanner) {
    stopScanning();
  }
  
  if (tab === 'scanner') {
    elements.tabScanner.className = "flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-all duration-300 text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shadow-sm";
    elements.tabSearch.className = "flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-all duration-300 text-gray-400 hover:text-white";
    elements.panelScanner.classList.remove('hidden');
    elements.panelSearch.classList.add('hidden');
    
    // จัดการ emptyState ในแท็บสแกน (ถ้าไม่มีการ์ดสินค้า ให้แสดง)
    if (elements.productDetailCard.classList.contains('hidden')) {
      elements.emptyState.classList.remove('hidden');
    } else {
      elements.emptyState.classList.add('hidden');
    }
  } else {
    elements.tabScanner.className = "flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-all duration-300 text-gray-400 hover:text-white";
    elements.tabSearch.className = "flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-all duration-300 text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shadow-sm";
    elements.panelScanner.classList.add('hidden');
    elements.panelSearch.classList.remove('hidden');
    
    // ซ่อน emptyState เสมอในแท็บค้นหา เพื่อไม่ให้เกะกะ list รายการสินค้าที่กำลังค้นหา
    elements.emptyState.classList.add('hidden');
    
    setTimeout(() => elements.searchInput.focus(), 100);
  }
}

// --- QR CODE SCANNER CONTROLLER ---
function startScanning() {
  elements.scannerWrapper.classList.remove('hidden');
  elements.scannerPlaceholder.classList.add('hidden');
  elements.scannerOverlay.classList.remove('hidden');
  elements.btnStartScan.classList.add('hidden');
  elements.btnStopScan.classList.remove('hidden');
  
  // 1. สร้างอินสแตนซ์สแกนเนอร์ใหม่
  currentScanner = new Html5Qrcode("reader");
  
  // กำหนดขนาด QR box ที่เหมาะสมแบบ Responsive
  const qrboxFunction = (viewWidth, viewHeight) => {
    const minEdge = Math.min(viewWidth, viewHeight);
    const qrboxSize = Math.floor(minEdge * 0.65);
    return {
      width: qrboxSize,
      height: qrboxSize
    };
  };

  // 2. สั่งเริ่มกล้องหลังทันที (facingMode: "environment")
  currentScanner.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: qrboxFunction,
      aspectRatio: 1.0
    },
    onScanSuccess,
    onScanError
  ).catch(err => {
    console.error("เริ่มสแกนเนอร์ล้มเหลว:", err);
    alert("ไม่สามารถเข้าใช้งานกล้องหลังได้ กรุณาให้สิทธิ์เข้าถึงกล้องสำหรับเบราว์เซอร์ในการตั้งค่าระบบของโทรศัพท์นะคะ");
    resetScannerUI();
  });
}

function stopScanning() {
  if (currentScanner) {
    currentScanner.stop().then(() => {
      currentScanner = null;
      resetScannerUI();
    }).catch(err => {
      console.error("ปิดกล้องล้มเหลว:", err);
      resetScannerUI();
    });
  } else {
    resetScannerUI();
  }
}

function resetScannerUI() {
  elements.scannerWrapper.classList.add('hidden');
  elements.scannerPlaceholder.classList.remove('hidden');
  elements.scannerOverlay.classList.add('hidden');
  elements.btnStartScan.classList.remove('hidden');
  elements.btnStopScan.classList.add('hidden');
  elements.cameraSelectContainer.classList.add('hidden');
  // ล้างเนื้อหากล้อง
  const readerDiv = document.getElementById('reader');
  if (readerDiv) readerDiv.innerHTML = '';
  // ใส่ตัว Placeholder กลับมา
  readerDiv.appendChild(elements.scannerPlaceholder);
}

function onScanSuccess(decodedText, decodedResult) {
  // 1. เล่นเสียงบี๊บพรีเมียม (Premium feedback)
  playBeepSound();
  
  // 2. หยุดกล้องทันที
  stopScanning();
  
  // 3. แสดงรหัสสินค้าที่ได้
  const scannedItem = String(decodedText).trim();
  displayProductDetail(scannedItem);
}

function onScanError(errorMessage) {
  // ปล่อยข้าม เพื่อไม่ให้ข้อความกวนใจ
  // html5-qrcode จะยิง Callback นี้ทุกๆ เฟรมภาพที่ไม่พบ QR code
}

// --- PREMIUM HARDWARE SCANNER BEEP SOUND ---
function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(950, audioCtx.currentTime); // โน้ตความถี่สูงนิดนึง ให้ความรู้สึกล้ำๆ
    
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    console.warn("การสร้างเสียงบี๊บล้มเหลว:", err);
  }
}

// --- AUTOCOMPLETE & MANUAL SEARCH CONTROLLER ---
function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  
  if (query.length > 0) {
    elements.btnClearSearch.classList.remove('hidden');
    
    // ค้นหาสินค้าที่มีคำตรงกับรหัส ITEM หรือชื่อ PART
    const matches = inventoryData.filter(item => {
      const matchItem = String(item.item).toLowerCase().includes(query);
      const matchName = String(item.name).toLowerCase().includes(query);
      return matchItem || matchName;
    }).slice(0, 10); // ลิมิตแสดง 10 รายการแนะนำ
    
    renderSuggestions(matches);
  } else {
    elements.btnClearSearch.classList.add('hidden');
    elements.suggestionsList.classList.add('hidden');
  }
}

function renderSuggestions(matches) {
  if (matches.length === 0) {
    elements.suggestionsList.innerHTML = `
      <div class="p-4 text-center text-xs text-gray-500">
        ไม่พบรหัสสินค้าหรือชื่อที่ตรงกันค่ะ 😢
      </div>
    `;
    elements.suggestionsList.classList.remove('hidden');
    return;
  }
  
  elements.suggestionsList.innerHTML = '';
  
  matches.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = "p-3.5 hover:bg-cyan-500/10 cursor-pointer transition flex justify-between items-center text-left";
    
    // จัดการการพิมพ์แสดงหัวข้อมูล
    const priceText = item.price !== null ? `฿${formatNumber(item.price)}` : 'ไม่มีราคา';
    
    itemDiv.innerHTML = `
      <div class="flex flex-col space-y-0.5 max-w-[70%]">
        <span class="text-sm font-bold text-gray-100 uppercase truncate">${item.item}</span>
        <span class="text-[11px] text-gray-400 truncate">${item.name || 'ไม่ระบุชื่อ Part'}</span>
      </div>
      <div class="text-right">
        <span class="text-xs font-semibold text-emerald-400">${priceText}</span>
        <span class="block text-[9px] text-gray-500">Model: ${item.model || '-'}</span>
      </div>
    `;
    
    itemDiv.addEventListener('click', () => {
      elements.searchInput.value = item.item;
      elements.suggestionsList.classList.add('hidden');
      displayProductDetail(item.item);
    });
    
    elements.suggestionsList.appendChild(itemDiv);
  });
  
  elements.suggestionsList.classList.remove('hidden');
}

// --- DISPLAY PRODUCT DETAIL ---
function displayProductDetail(itemCode) {
  const codeClean = String(itemCode).trim().toLowerCase();
  
  // ค้นหาในตัวแปรหลัก
  const product = inventoryData.find(p => String(p.item).trim().toLowerCase() === codeClean);
  
  if (product) {
    // ซ่อน Empty State, แสดง Product Detail Card
    elements.emptyState.classList.add('hidden');
    elements.productDetailCard.classList.remove('hidden');
    
    // ล้างและระบายแอนิเมชันใหม่
    elements.productDetailCard.firstElementChild.classList.remove('animate-slide-up');
    void elements.productDetailCard.firstElementChild.offsetWidth; // Trigger reflow
    elements.productDetailCard.firstElementChild.classList.add('animate-slide-up');
    
    // ใส่ค่าต่างๆ
    elements.detailItem.textContent = product.item;
    elements.detailName.textContent = product.name || 'ไม่ระบุชื่อ Part';
    elements.detailModel.textContent = product.model || '-';
    elements.detailDrawing.textContent = product.drawing || '-';
    
    // ใส่ค่าราคาขาย
    if (product.price !== null && !isNaN(Number(product.price))) {
      elements.detailPrice.textContent = `฿${formatNumber(product.price)}`;
    } else {
      elements.detailPrice.textContent = product.price || '-';
    }
    
    // ใส่ค่าราคาวัตถุดิบ
    if (product.rm_price !== null && !isNaN(Number(product.rm_price))) {
      elements.detailRmPrice.textContent = `฿${formatNumber(product.rm_price)}`;
    } else {
      elements.detailRmPrice.textContent = product.rm_price || '-';
    }
    
    // คำนวณ Margin
    const priceNum = Number(product.price);
    const rmPriceNum = Number(product.rm_price);
    
    if (
      product.price !== null && 
      product.rm_price !== null && 
      !isNaN(priceNum) && 
      !isNaN(rmPriceNum) &&
      priceNum > 0
    ) {
      elements.detailMarginCard.classList.remove('hidden');
      const profit = priceNum - rmPriceNum;
      const marginPct = (profit / priceNum) * 100;
      
      elements.detailMarginValue.textContent = `฿${formatNumber(profit)} (${marginPct.toFixed(1)}%)`;
      elements.detailMarginBar.style.width = `${Math.max(0, Math.min(100, marginPct))}%`;
      
      // ปรับแต่งสีของ Bar ตามอัตรากำไร
      if (marginPct < 25) {
        elements.detailMarginBar.className = "bg-gradient-to-r from-red-500 to-rose-400 h-full rounded-full transition-all duration-500";
        elements.detailMarginValue.className = "font-bold text-rose-400";
      } else if (marginPct < 50) {
        elements.detailMarginBar.className = "bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500";
        elements.detailMarginValue.className = "font-bold text-amber-400";
      } else {
        elements.detailMarginBar.className = "bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500";
        elements.detailMarginValue.className = "font-bold text-emerald-400";
      }
    } else {
      elements.detailMarginCard.classList.add('hidden');
    }
    
  } else {
    // ไม่พบสินค้า
    elements.productDetailCard.classList.add('hidden');
    if (currentTab === 'scanner') {
      elements.emptyState.classList.remove('hidden');
    }
    
    alert(`ไม่พบข้อมูลสินค้ารหัส "${itemCode}" ในฐานข้อมูลค่ะ 😢\nกรุณาตรวจสอบว่ามีสินค้านี้ใน Google Sheets หรือยังนะคะ`);
  }
}

function closeProductCard() {
  elements.productDetailCard.classList.add('hidden');
  if (currentTab === 'scanner') {
    elements.emptyState.classList.remove('hidden');
  }
}

// --- HELPER FUNCTIONS ---
function formatNumber(num) {
  return Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

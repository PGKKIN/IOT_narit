import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Brush 
} from 'recharts';
import { 
  Activity, 
  Thermometer, 
  Droplets, 
  Wind, 
  AlertTriangle, 
  Download, 
  Clock, 
  Cpu, 
  Server,
  Sun,
  Moon,
  Calendar,
  Sliders,
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Tv,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Save,
  Info,
  Copy,
  Camera
} from 'lucide-react';

const API_BASE_URL = `http://${window.location.hostname}:8000`;

const colorMap = {
  blue: { text: 'text-blue-500', bg: 'bg-blue-500/10', icon: 'text-blue-500' },
  green: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: 'text-emerald-500' },
  yellow: { text: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: 'text-yellow-500' },
  orange: { text: 'text-orange-500', bg: 'bg-orange-500/10', icon: 'text-orange-500' },
  red: { text: 'text-red-500', bg: 'bg-red-500/10', icon: 'text-red-500' },
  purple: { text: 'text-purple-500', bg: 'bg-purple-500/10', icon: 'text-purple-500' },
  cyan: { text: 'text-cyan-500', bg: 'bg-cyan-500/10', icon: 'text-cyan-500' },
};

const getCO2Status = (value) => {
  if (value === null) return { theme: colorMap.blue, text: null, desc: null };
  if (value <= 450) return { theme: colorMap.green, text: 'อากาศภายนอกอาคารปกติ', desc: 'เป็นค่ามาตรฐานของอากาศบริสุทธิ์ทั่วไป' };
  if (value <= 1000) return { theme: colorMap.green, text: 'อากาศในอาคารที่ดี', desc: 'ระบายอากาศได้เหมาะสม ไม่ส่งผลเสียต่อร่างกาย' };
  if (value <= 2000) return { theme: colorMap.yellow, text: 'เริ่มส่งผลต่อสมาธิ', desc: 'เริ่มรู้สึกง่วงนอน ขาดสมาธิ การตัดสินใจลดลง' };
  if (value <= 5000) return { theme: colorMap.orange, text: 'อากาศแย่', desc: 'ปวดหัว อ่อนเพลีย หัวใจเต้นเร็ว คลื่นไส้' };
  if (value <= 40000) return { theme: colorMap.red, text: 'อันตราย (Toxic Level)', desc: 'ขีดจำกัด 8 ชม. สูงกว่านี้อันตรายต่อทางเดินหายใจ' };
  return { theme: colorMap.purple, text: 'วิกฤต', desc: 'ขาดออกซิเจนอย่างรุนแรง อาจหมดสติหรือเสียชีวิตได้' };
};

const getTVOCStatus = (value) => {
  if (value === null) return { theme: colorMap.blue, alert: null };
  if (value > 220) return { theme: colorMap.orange, alert: 'High TVOC Levels' };
  return { theme: colorMap.blue, alert: null };
};

const themeGlows = {
  'text-blue-500': 'rgba(59, 130, 246, 0.12)',
  'text-emerald-500': 'rgba(16, 185, 129, 0.12)',
  'text-yellow-500': 'rgba(245, 158, 11, 0.12)',
  'text-orange-500': 'rgba(249, 115, 22, 0.12)',
  'text-red-500': 'rgba(239, 68, 68, 0.12)',
  'text-purple-500': 'rgba(168, 85, 247, 0.12)',
  'text-cyan-500': 'rgba(6, 182, 212, 0.12)',
};

const themeBorders = {
  'text-blue-500': 'rgba(59, 130, 246, 0.4)',
  'text-emerald-500': 'rgba(16, 185, 129, 0.4)',
  'text-yellow-500': 'rgba(245, 158, 11, 0.4)',
  'text-orange-500': 'rgba(249, 115, 22, 0.4)',
  'text-red-500': 'rgba(239, 68, 68, 0.4)',
  'text-purple-500': 'rgba(168, 85, 247, 0.4)',
  'text-cyan-500': 'rgba(6, 182, 212, 0.4)',
};

const insertOfflineGaps = (data) => {
  if (!data || data.length === 0) return data;
  
  // Calculate median time step dynamically to handle varying resolutions
  const stepSizes = [];
  for (let i = 1; i < data.length; i++) {
    const prevItem = data[i - 1];
    const currentItem = data[i];
    const prevTime = new Date(prevItem.timestamp ? prevItem.timestamp.replace(' ', 'T') : '').getTime();
    const currTime = new Date(currentItem.timestamp ? currentItem.timestamp.replace(' ', 'T') : '').getTime();
    if (!isNaN(prevTime) && !isNaN(currTime)) {
      const diff = currTime - prevTime;
      if (diff > 0) {
        stepSizes.push(diff);
      }
    }
  }
  
  // Sort to find the median step size, defaulting to 1 minute if not enough points
  stepSizes.sort((a, b) => a - b);
  const medianStep = stepSizes.length > 0 ? stepSizes[Math.floor(stepSizes.length / 2)] : (60 * 1000);
  
  // Gap threshold is 3 minutes or 2.5 times the median step size, whichever is larger
  const gapThresholdMs = Math.max(3 * 60 * 1000, medianStep * 2.5);
  
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    const currentItem = data[i];
    
    if (i > 0) {
      const prevItem = data[i - 1];
      const prevTime = new Date(prevItem.timestamp ? prevItem.timestamp.replace(' ', 'T') : '').getTime();
      const currTime = new Date(currentItem.timestamp ? currentItem.timestamp.replace(' ', 'T') : '').getTime();
      
      if (!isNaN(prevTime) && !isNaN(currTime) && (currTime - prevTime) > gapThresholdMs) {
        // Insert a null point 10% of medianStep (max 30s) after the last valid point
        const gapOffset = Math.min(30000, medianStep * 0.1);
        const gapStartTime = new Date(prevTime + gapOffset);
        const gapStartStr = gapStartTime.toISOString().replace('T', ' ').substring(0, 19);
        
        result.push({
          timestamp: gapStartStr,
          temperature: null,
          humidity: null,
          eco2: null,
          tvoc: null,
          dht_temp: null,
          dht_hum: null,
          ds1_temp: null,
          ds2_temp: null,
          ds3_temp: null,
          isOfflineGap: true
        });

        // Insert a null point 10% of medianStep (max 30s) before the current valid point
        const gapEndTime = new Date(currTime - gapOffset);
        const gapEndStr = gapEndTime.toISOString().replace('T', ' ').substring(0, 19);
        
        result.push({
          timestamp: gapEndStr,
          temperature: null,
          humidity: null,
          eco2: null,
          tvoc: null,
          dht_temp: null,
          dht_hum: null,
          ds1_temp: null,
          ds2_temp: null,
          ds3_temp: null,
          isOfflineGap: true
        });
      }
    }
    result.push(currentItem);
  }
  return result;
};

const StatCard = ({ title, value, unit, icon: Icon, theme, alert, subtitle, isDarkMode, isOffline, lastValidValue }) => {
  const t = isOffline ? colorMap.red : (theme || colorMap.blue);
  const glowColor = themeGlows[t.icon] || 'rgba(59, 130, 246, 0.12)';
  const borderColor = themeBorders[t.icon] || 'rgba(51, 65, 85, 0.8)';
  return (
    <div 
      className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 flex flex-col relative overflow-hidden group border-t-4 ${isOffline ? 'border-t-red-500' : 'border-t-transparent hover:border-t-current'} ${t.text}`}
      style={{
        '--card-glow-color': glowColor,
        '--card-border-color': borderColor,
      }}
    >
      <div className="absolute -right-6 -top-6 opacity-10 group-hover:scale-110 transition-transform duration-300">
        <Icon size={100} className={t.icon} />
      </div>
      <div className={`flex justify-between items-start mb-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
        <h3 className="font-medium flex items-center gap-1.5">
          {title}
          {isOffline && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-500 border border-red-500/20 animate-pulse">
              OFFLINE
            </span>
          )}
        </h3>
        <div className={`p-2 rounded-lg ${t.bg} ${t.icon}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${isOffline ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
          {isOffline ? (lastValidValue != null ? lastValidValue : '--') : (value != null ? value : '--')}
        </span>
        <span className={`${isOffline ? 'text-red-400/80' : (isDarkMode ? 'text-gray-400' : 'text-slate-500')} mb-1`}>{unit}</span>
      </div>
      {isOffline && (
        <div className={`mt-3 text-xs font-semibold ${isDarkMode ? 'text-red-400/70' : 'text-red-600/70'}`}>
          ล่าสุด: {lastValidValue != null ? `${lastValidValue} ${unit}` : 'ไม่มีข้อมูล'}
        </div>
      )}
      {!isOffline && subtitle && (
        <div className={`mt-3 text-sm font-semibold ${t.text}`}>
          {subtitle}
        </div>
      )}
      {!isOffline && alert && (
        <div className={`mt-3 flex items-start text-xs p-3 rounded-lg border ${
          isDarkMode 
            ? 'text-gray-300 bg-slate-800/60 border-slate-700/50' 
            : 'text-slate-600 bg-slate-50 border-slate-200/80'
        }`}>
          <AlertTriangle size={14} className={`mr-2 mt-0.5 flex-shrink-0 ${t.icon}`} />
          <span>{alert}</span>
        </div>
      )}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, isDarkMode }) => {
  const formatVal = (num, name) => {
    if (num === null || num === undefined) return '--';
    const val = Number(num);
    if (isNaN(val)) return num;
    if (name && (name.toLowerCase().includes('co2') || name.toLowerCase().includes('tvoc'))) {
      return val.toFixed(0);
    }
    return val.toFixed(1);
  };

  if (active && payload && payload.length) {
    const rawData = payload[0]?.payload || {};
    return (
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} border p-3.5 max-w-xs shadow-xl`}>
        <p className={`font-semibold mb-2 border-b pb-1.5 text-xs ${isDarkMode ? 'border-slate-700 text-gray-200' : 'border-slate-200 text-slate-800'}`}>{label}</p>
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null;
          
          let minVal = null;
          let maxVal = null;
          if (entry.dataKey === 'temperature') {
            minVal = rawData.min_temp; maxVal = rawData.max_temp;
          } else if (entry.dataKey === 'humidity') {
            minVal = rawData.min_hum; maxVal = rawData.max_hum;
          } else if (entry.dataKey === 'dht_temp') {
            minVal = rawData.min_dht_temp; maxVal = rawData.max_dht_temp;
          } else if (entry.dataKey === 'dht_hum') {
            minVal = rawData.min_dht_hum; maxVal = rawData.max_dht_hum;
          }

          const hasRange = minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined && minVal !== maxVal;

          return (
            <div key={index} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className={isDarkMode ? 'text-gray-300' : 'text-slate-600'}>{entry.name}:</span>
                </div>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {formatVal(entry.value, entry.name)}
                </span>
              </div>
              {hasRange && (
                <div className={`text-[10px] pl-4 mt-0.5 font-mono flex justify-between ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Min / Max:</span>
                  <span>{formatVal(minVal, entry.name)} - {formatVal(maxVal, entry.name)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const DateTimePicker24h = ({ value, onChange, isDarkMode, dropPosition = "auto" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState("bottom");
  const dropdownRef = useRef(null);

  const dateVal = value ? value.split('T')[0] : '';
  const timeVal = value && value.includes('T') ? value.split('T')[1] : '00:00';
  const hourVal = timeVal ? timeVal.split(':')[0].padStart(2, '0') : '00';
  const minuteVal = timeVal ? timeVal.split(':')[1].padStart(2, '0') : '00';

  const formatDisplay = () => {
    if (!value || !dateVal) return "เลือกวันและเวลา (24h)...";
    const [y, m, d] = dateVal.split('-');
    return `${d}/${m}/${y} ${hourVal}:${minuteVal} น.`;
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    if (!d) {
      onChange('');
      return;
    }
    onChange(`${d}T${hourVal}:${minuteVal}`);
  };

  const handleHourChange = (e) => {
    const h = e.target.value;
    const nowStr = new Date().toISOString().slice(0, 10);
    const d = dateVal || nowStr;
    onChange(`${d}T${h}:${minuteVal}`);
  };

  const handleMinuteChange = (e) => {
    const m = e.target.value;
    const nowStr = new Date().toISOString().slice(0, 10);
    const d = dateVal || nowStr;
    onChange(`${d}T${hourVal}:${m}`);
  };

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (dropPosition === "top" || (dropPosition === "auto" && spaceBelow < 320)) {
        setPlacement("top");
      } else {
        setPlacement("bottom");
      }
    }
  }, [isOpen, dropPosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block w-full min-w-[210px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer ${
          value
            ? isDarkMode 
              ? 'bg-blue-950/50 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/10' 
              : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
            : isDarkMode
              ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
              : 'bg-white border-slate-300 text-slate-500 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-blue-500 flex-shrink-0" />
          <span>{formatDisplay()}</span>
        </div>
        <Clock size={13} className="opacity-60 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className={`absolute left-0 z-[9999] p-4 rounded-2xl border shadow-2xl backdrop-blur-xl w-72 transition-all animate-fade-in ${
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${
          isDarkMode 
            ? 'bg-slate-900/95 border-slate-700 text-slate-200 shadow-slate-950/80' 
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
        }`}>
          <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-700/40">
            <span className="text-xs font-bold flex items-center gap-1.5 text-blue-500">
              <Clock size={14} /> เลือกเวลาแบบ 24 ชั่วโมง
            </span>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)} 
              className="text-xs font-bold text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mb-3">
            <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">1. เลือกวันที่ (Date)</label>
            <input 
              type="date" 
              value={dateVal} 
              onChange={handleDateChange}
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-2 px-3 rounded-xl font-mono`}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">2. เลือกเวลา (ชั่วโมง : นาที)</label>
            <div className="flex items-center gap-2 bg-slate-800/20 p-2 rounded-xl border border-slate-700/30">
              <select 
                value={hourVal} 
                onChange={handleHourChange}
                className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5 px-2 rounded-lg font-mono font-bold text-center cursor-pointer`}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hStr = i.toString().padStart(2, '0');
                  return <option key={hStr} value={hStr}>{hStr} : 00 น.</option>;
                })}
              </select>

              <span className="font-bold text-base opacity-60">:</span>

              <select 
                value={minuteVal} 
                onChange={handleMinuteChange}
                className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5 px-2 rounded-lg font-mono font-bold text-center cursor-pointer`}
              >
                {Array.from({ length: 60 }, (_, i) => {
                  const mStr = i.toString().padStart(2, '0');
                  return <option key={mStr} value={mStr}>{mStr} นาที</option>;
                })}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-700/40 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer"
            >
              ตกลง (Done)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('cleanroom');
  const [latestData, setLatestData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [isOnline, setIsOnline] = useState(false);
  const [isSensorActive, setIsSensorActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alertLogs, setAlertLogs] = useState([]);
  const [recipientEmails, setRecipientEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [toasts, setToasts] = useState([]);

  // New Feature States: TV Kiosk Mode, Dynamic Thresholds, PDF Export Modal
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfRangeType, setPdfRangeType] = useState('current_month');
  const [pdfStart, setPdfStart] = useState('');
  const [pdfEnd, setPdfEnd] = useState('');
  const [rangeInfo, setRangeInfo] = useState(null);
  
  // Dynamic Threshold States
  const [threshCleanHum, setThreshCleanHum] = useState(60);
  const [threshFabHum, setThreshFabHum] = useState(65);
  const [threshTempHigh, setThreshTempHigh] = useState(40);
  const [isSavingThresh, setIsSavingThresh] = useState(false);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Fetch Config (Thresholds + Emails)
  const fetchConfigData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/config`);
      if (res.data) {
        if (res.data.recipient_emails) setRecipientEmails(res.data.recipient_emails);
        if (res.data.humidity_threshold_cleanroom !== undefined) setThreshCleanHum(res.data.humidity_threshold_cleanroom);
        if (res.data.humidity_threshold_fablab !== undefined) setThreshFabHum(res.data.humidity_threshold_fablab);
        if (res.data.temp_threshold_high !== undefined) setThreshTempHigh(res.data.temp_threshold_high);
      }
    } catch (e) {
      console.error("Failed to fetch config data", e);
    }
  };

  const handleSaveThresholds = async () => {
    setIsSavingThresh(true);
    try {
      await axios.post(`${API_BASE_URL}/config`, {
        humidity_threshold_cleanroom: parseFloat(threshCleanHum),
        humidity_threshold_fablab: parseFloat(threshFabHum),
        temp_threshold_high: parseFloat(threshTempHigh)
      });
      showToast(`บันทึกสำเร็จ! เกณฑ์ปัจจุบัน: Cleanroom Hum ${threshCleanHum}%, FabLab Hum ${threshFabHum}%, Max Temp ${threshTempHigh}°C`, "success");
    } catch (e) {
      showToast("เกิดข้อผิดพลาดในการบันทึกเกณฑ์", "danger");
    } finally {
      setIsSavingThresh(false);
    }
  };

  useEffect(() => {
    fetchConfigData();
  }, []);

  // Chart Axis Limit States (Custom yMin/yMax settings) - Persisted in localStorage
  const [tempYMin, setTempYMin] = useState(() => localStorage.getItem('tempYMin') || '');
  const [tempYMax, setTempYMax] = useState(() => localStorage.getItem('tempYMax') || '');
  const [humYMin, setHumYMin] = useState(() => localStorage.getItem('humYMin') || '');
  const [humYMax, setHumYMax] = useState(() => localStorage.getItem('humYMax') || '');
  const [co2YMin, setCo2YMin] = useState(() => localStorage.getItem('co2YMin') || '');
  const [co2YMax, setCo2YMax] = useState(() => localStorage.getItem('co2YMax') || '');
  const [tvocYMin, setTvocYMin] = useState(() => localStorage.getItem('tvocYMin') || '');
  const [tvocYMax, setTvocYMax] = useState(() => localStorage.getItem('tvocYMax') || '');

  // Refs for mouse-drag vertical/horizontal panning
  const dragStartXRef = useRef(null);
  const dragStartYRef = useRef(null);
  const dragStartLimitsRef = useRef({});
  const activeDragChartRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragDirectionRef = useRef(null); // 'horizontal', 'vertical', or null

  // Theme, Filter, Clock States
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved !== null ? saved === 'true' : true;
  });

  // Persist Theme and Axis Limit settings to localStorage
  useEffect(() => {
    localStorage.setItem('isDarkMode', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('tempYMin', tempYMin);
    localStorage.setItem('tempYMax', tempYMax);
    localStorage.setItem('humYMin', humYMin);
    localStorage.setItem('humYMax', humYMax);
    localStorage.setItem('co2YMin', co2YMin);
    localStorage.setItem('co2YMax', co2YMax);
    localStorage.setItem('tvocYMin', tvocYMin);
    localStorage.setItem('tvocYMax', tvocYMax);
  }, [tempYMin, tempYMax, humYMin, humYMax, co2YMin, co2YMax, tvocYMin, tvocYMax]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resolution, setResolution] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Controlled Zoom & Pan States
  const [zoomStart, setZoomStart] = useState(null);
  const [zoomEnd, setZoomEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [brushKey, setBrushKey] = useState(0);
  const isDraggingBrushRef = useRef(false);

  // Event Listener refs for Scroll Zoom
  const fablabTempChartRef = useRef(null);
  const fablabHumChartRef = useRef(null);
  const fablabAqChartRef = useRef(null);
  const cleanroomTempChartRef = useRef(null);
  const cleanroomHumChartRef = useRef(null);

  // Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAlertLogs = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/alerts`);
      setAlertLogs(response.data);
    } catch (error) {
      console.error("Error fetching alert logs", error);
    }
  };

  const handleClearAlertLogs = async () => {
    if (window.confirm("คุณต้องการล้างประวัติการแจ้งเตือนทั้งหมดใช่หรือไม่?")) {
      try {
        await axios.post(`${API_BASE_URL}/data/alerts/clear`);
        setAlertLogs([]);
        showToast("ล้างประวัติการแจ้งเตือนภัยทั้งหมดเรียบร้อยแล้ว", "success");
      } catch (error) {
        console.error("Error clearing alert logs", error);
        showToast("ล้างประวัติการแจ้งเตือนล้มเหลว", "error");
      }
    }
  };

  const fetchRecipientEmails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/config/emails`);
      setRecipientEmails(response.data);
    } catch (error) {
      console.error("Error fetching recipient emails", error);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    
    if (!email.includes('@') || !email.includes('.')) {
      showToast("กรุณากรอกรูปแบบอีเมลให้ถูกต้อง", "error");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/config/emails`, { email });
      setRecipientEmails(response.data);
      setNewEmail('');
      showToast("เพิ่มอีเมลผู้รับแจ้งเตือนสำเร็จแล้ว", "success");
    } catch (error) {
      console.error("Error adding email", error);
      showToast(error.response?.data?.detail || "เกิดข้อผิดพลาดในการเพิ่มอีเมล", "error");
    }
  };

  const handleRemoveEmail = async (emailToRemove) => {
    if (window.confirm(`คุณต้องการลบอีเมล ${emailToRemove} ออกจากการแจ้งเตือนใช่หรือไม่?`)) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/config/emails`, {
          params: { email: emailToRemove }
        });
        setRecipientEmails(response.data);
        showToast("ลบอีเมลออกจากการแจ้งเตือนสำเร็จ", "success");
      } catch (error) {
        console.error("Error removing email", error);
        showToast(error.response?.data?.detail || "เกิดข้อผิดพลาดในการลบอีเมล", "error");
      }
    }
  };

  const fetchLatestData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/${activeTab}/latest`);
      setLatestData(response.data);
      setIsOnline(true);
      setLastUpdated(new Date());
      
      const isActive = response.headers['x-sensor-active'] === 'true';
      setIsSensorActive(isActive);
    } catch (error) {
      console.error("Error fetching latest data", error);
      setIsOnline(false);
      setIsSensorActive(false);
    }
  };

  const fetchHistoryData = async () => {
    try {
      const params = {};
      if (startTime) params.start_time = startTime;
      if (endTime) params.end_time = endTime;
      if (resolution > 0) params.resolution = resolution;
      
      if (!startTime && !endTime) {
        params.range = timeRange;
      }
      
      const response = await axios.get(`${API_BASE_URL}/data/${activeTab}/history`, { params });
      const dataWithGaps = insertOfflineGaps(response.data);
      const formattedData = dataWithGaps.map(item => {
        const dateStr = item.timestamp ? item.timestamp.replace(' ', 'T') : '';
        const parsedDate = new Date(dateStr);
        const displayTime = isNaN(parsedDate.getTime()) 
          ? (item.timestamp || '') 
          : parsedDate.toLocaleString('en-GB', { 
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            }).replace(',', '');
            
        return {
          ...item,
          displayTime,
          tempRange: [item.min_temp ?? item.temperature, item.max_temp ?? item.temperature],
          humRange: [item.min_hum ?? item.humidity, item.max_hum ?? item.humidity],
          dhtTempRange: [item.min_dht_temp ?? item.dht_temp, item.max_dht_temp ?? item.dht_temp],
          dhtHumRange: [item.min_dht_hum ?? item.dht_hum, item.max_dht_hum ?? item.dht_hum]
        };
      });
      setHistoryData(formattedData);
    } catch (error) {
      console.error("Error fetching history data", error);
    }
  };

  const handleDownloadChart = async (ref, fileName, chartTitle) => {
    try {
      if (!ref.current) return;
      const svgElement = ref.current.querySelector('svg');
      if (!svgElement) {
        showToast("ไม่พบ SVG ของกราฟ", "error");
        return;
      }
      
      // Parse legend items from default Recharts legend element
      const legendItems = [];
      const legendEl = ref.current.querySelector('.recharts-default-legend');
      if (legendEl) {
        const items = legendEl.querySelectorAll('.recharts-legend-item');
        items.forEach(item => {
          const textEl = item.querySelector('.recharts-legend-item-text');
          const surface = item.querySelector('.recharts-surface');
          let color = '#3b82f6';
          if (surface) {
            const path = surface.querySelector('path');
            const circle = surface.querySelector('circle');
            if (path) {
              color = path.getAttribute('fill') || path.getAttribute('stroke') || color;
            } else if (circle) {
              color = circle.getAttribute('fill') || circle.getAttribute('stroke') || color;
            }
          }
          legendItems.push({
            text: textEl ? textEl.textContent : '',
            color: color
          });
        });
      }

      const svgClone = svgElement.cloneNode(true);
      const originalWidth = svgElement.clientWidth || 800;
      const originalHeight = svgElement.clientHeight || 400;
      const width = Math.max(900, originalWidth); // Enforce min width of 900px for optimal legend spacing and clarity
      const height = Math.min(520, Math.round(originalHeight * (width / originalWidth))); // Cap height at 520px to increase Y-axis scale while keeping it balanced
      
      svgClone.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      
      const isDark = isDarkMode;
      const bg = isDark ? '#1e293b' : '#ffffff';
      const textColor = isDark ? '#f8fafc' : '#334155';
      
      const styleElement = document.createElement('style');
      styleElement.innerHTML = `
        svg { background-color: ${bg}; color: ${textColor}; font-family: sans-serif; }
        text { fill: ${textColor}; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: ${isDark ? '#334155' : '#e2e8f0'}; }
      `;
      svgClone.insertBefore(styleElement, svgClone.firstChild);
      
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const padX = 50;
        const padY = 100;
        const extraTop = 35;
        const extraBottom = 22;
        
        canvas.width = (width + padX * 2) * 2;
        canvas.height = (height + extraTop + extraBottom + padY * 2) * 2;
        const context = canvas.getContext('2d');
        context.scale(2, 2);
        
        context.fillStyle = bg;
        context.fillRect(0, 0, width + padX * 2, height + extraTop + extraBottom + padY * 2);
        
        // Draw Chart Title at the top
        if (chartTitle) {
          context.font = 'bold 14px sans-serif';
          context.fillStyle = textColor;
          context.textAlign = 'center';
          context.fillText(chartTitle, width / 2 + padX, padY + 20);
          context.textAlign = 'left'; // Reset alignment to default
        }
        
        context.drawImage(image, padX, padY + extraTop, width, height);
        
        // Draw Legend manually onto canvas space below chart
        if (legendItems.length > 0) {
          context.font = '12px sans-serif';
          context.textBaseline = 'middle';
          
          let totalWidth = 0;
          const spacing = 15;
          const itemWidths = [];
          
          legendItems.forEach(item => {
            const textWidth = context.measureText(item.text).width;
            const itemWidth = 16 + 6 + textWidth; // dot + text padding
            itemWidths.push(itemWidth);
            totalWidth += itemWidth;
          });
          totalWidth += (legendItems.length - 1) * spacing;
          
          let startX = (width + padX * 2 - totalWidth) / 2;
          const startY = height + extraTop + padY + 10; // Shifted legend up closer to the graph
          
          legendItems.forEach((item, idx) => {
            // Draw color dot
            context.fillStyle = item.color;
            context.beginPath();
            context.arc(startX + 6, startY, 5, 0, 2 * Math.PI); // slightly larger dot
            context.fill();
            
            // Draw text
            context.fillStyle = textColor;
            context.fillText(item.text, startX + 16, startY); // shift text to prevent overlapping with larger dot
            
            startX += itemWidths[idx] + spacing;
          });
        }
        
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          showToast("บันทึกรูปภาพกราฟสำเร็จ!", "success");
        }, 'image/png');
        
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error(err);
      showToast("ไม่สามารถสร้างรูปภาพกราฟได้", "error");
    }
  };

  const handleCopyChart = async (ref, chartTitle) => {
    try {
      if (!ref.current) return;
      const svgElement = ref.current.querySelector('svg');
      if (!svgElement) {
        showToast("ไม่พบ SVG ของกราฟ", "error");
        return;
      }
      
      // Parse legend items from default Recharts legend element
      const legendItems = [];
      const legendEl = ref.current.querySelector('.recharts-default-legend');
      if (legendEl) {
        const items = legendEl.querySelectorAll('.recharts-legend-item');
        items.forEach(item => {
          const textEl = item.querySelector('.recharts-legend-item-text');
          const surface = item.querySelector('.recharts-surface');
          let color = '#3b82f6';
          if (surface) {
            const path = surface.querySelector('path');
            const circle = surface.querySelector('circle');
            if (path) {
              color = path.getAttribute('fill') || path.getAttribute('stroke') || color;
            } else if (circle) {
              color = circle.getAttribute('fill') || circle.getAttribute('stroke') || color;
            }
          }
          legendItems.push({
            text: textEl ? textEl.textContent : '',
            color: color
          });
        });
      }

      const svgClone = svgElement.cloneNode(true);
      const originalWidth = svgElement.clientWidth || 800;
      const originalHeight = svgElement.clientHeight || 400;
      const width = Math.max(900, originalWidth); // Enforce min width of 900px for optimal legend spacing and clarity
      const height = Math.min(520, Math.round(originalHeight * (width / originalWidth))); // Cap height at 520px to increase Y-axis scale while keeping it balanced
      
      svgClone.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      
      const isDark = isDarkMode;
      const bg = isDark ? '#1e293b' : '#ffffff';
      const textColor = isDark ? '#f8fafc' : '#334155';
      
      const styleElement = document.createElement('style');
      styleElement.innerHTML = `
        svg { background-color: ${bg}; color: ${textColor}; font-family: sans-serif; }
        text { fill: ${textColor}; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: ${isDark ? '#334155' : '#e2e8f0'}; }
      `;
      svgClone.insertBefore(styleElement, svgClone.firstChild);
      
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const padX = 50;
        const padY = 100;
        const extraTop = 35;
        const extraBottom = 22;
        
        canvas.width = (width + padX * 2) * 2;
        canvas.height = (height + extraTop + extraBottom + padY * 2) * 2;
        const context = canvas.getContext('2d');
        context.scale(2, 2);
        
        context.fillStyle = bg;
        context.fillRect(0, 0, width + padX * 2, height + extraTop + extraBottom + padY * 2);
        
        // Draw Chart Title at the top
        if (chartTitle) {
          context.font = 'bold 14px sans-serif';
          context.fillStyle = textColor;
          context.textAlign = 'center';
          context.fillText(chartTitle, width / 2 + padX, padY + 20);
          context.textAlign = 'left'; // Reset alignment to default
        }
        
        context.drawImage(image, padX, padY + extraTop, width, height);
        
        // Draw Legend manually onto canvas space below chart
        if (legendItems.length > 0) {
          context.font = '12px sans-serif';
          context.textBaseline = 'middle';
          
          let totalWidth = 0;
          const spacing = 15;
          const itemWidths = [];
          
          legendItems.forEach(item => {
            const textWidth = context.measureText(item.text).width;
            const itemWidth = 16 + 6 + textWidth; // dot + text padding
            itemWidths.push(itemWidth);
            totalWidth += itemWidth;
          });
          totalWidth += (legendItems.length - 1) * spacing;
          
          let startX = (width + padX * 2 - totalWidth) / 2;
          const startY = height + extraTop + padY + 10; // Shifted legend up closer to the graph
          
          legendItems.forEach((item, idx) => {
            // Draw color dot
            context.fillStyle = item.color;
            context.beginPath();
            context.arc(startX + 6, startY, 5, 0, 2 * Math.PI); // slightly larger dot
            context.fill();
            
            // Draw text
            context.fillStyle = textColor;
            context.fillText(item.text, startX + 16, startY); // shift text to prevent overlapping with larger dot
            
            startX += itemWidths[idx] + spacing;
          });
        }
        
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const data = [new ClipboardItem({ [blob.type]: blob })];
            await navigator.clipboard.write(data);
            showToast("คัดลอกรูปภาพกราฟลง Clipboard สำเร็จ! (สามารถกด Ctrl+V วางใน Word ได้เลย)", "success");
          } catch (clipErr) {
            console.error(clipErr);
            showToast("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง ลองใช้ปุ่มดาวน์โหลดแทน", "warning");
          }
        }, 'image/png');
        
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error(err);
      showToast("ไม่สามารถคัดลอกรูปภาพกราฟได้", "error");
    }
  };

  useEffect(() => {
    setLatestData(null);
    setHistoryData([]);
    setIsOnline(false);
    fetchLatestData();
    fetchHistoryData();
    fetchAlertLogs();
    fetchRecipientEmails();
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLatestData();
      fetchAlertLogs();
      fetchHistoryData();
    }, 10000); // Refresh all data every 10 seconds
    return () => clearInterval(interval);
  }, [activeTab, lastUpdated, timeRange, startTime, endTime, resolution]);

  useEffect(() => {
    setZoomStart(null);
    setZoomEnd(null);
    fetchHistoryData();
  }, [timeRange, activeTab, startTime, endTime, resolution]);

  // Sync zoom boundaries on history update
  useEffect(() => {
    if (historyData.length > 0) {
      if (zoomStart === null || zoomEnd === null) {
        setZoomStart(0);
        setZoomEnd(historyData.length - 1);
      } else {
        setZoomEnd(prevEnd => {
          if (prevEnd === null) return historyData.length - 1;
          return Math.min(historyData.length - 1, prevEnd);
        });
      }
      setBrushKey(prev => prev + 1);
    } else {
      setZoomStart(null);
      setZoomEnd(null);
    }
  }, [historyData]);

  // Synchronize values to a ref to bypass stale closure warnings
  const zoomStateRef = useRef({ zoomStart, zoomEnd, historyData });
  useEffect(() => {
    zoomStateRef.current = { zoomStart, zoomEnd, historyData };
  }, [zoomStart, zoomEnd, historyData]);

  // Synchronize all drag-related state values to a ref to keep handlers reference-stable
  const dragStateRef = useRef({});
  useEffect(() => {
    dragStateRef.current = {
      zoomStart,
      zoomEnd,
      tempYMin,
      tempYMax,
      humYMin,
      humYMax,
      co2YMin,
      co2YMax,
      tvocYMin,
      tvocYMax
    };
  }, [zoomStart, zoomEnd, tempYMin, tempYMax, humYMin, humYMax, co2YMin, co2YMax, tvocYMin, tvocYMax]);

  // Handle Scroll Zoom (Scroll Wheel) via global document listener
  useEffect(() => {
    const handleGlobalWheel = (e) => {
      const elements = [
        fablabTempChartRef.current,
        fablabHumChartRef.current,
        fablabAqChartRef.current,
        cleanroomTempChartRef.current,
        cleanroomHumChartRef.current
      ];
      
      const targetChart = elements.find(el => el && el.contains(e.target));
      if (!targetChart) return;

      // We are over one of the charts, prevent screen scroll
      e.preventDefault();

      const { zoomStart: zStart, zoomEnd: zEnd, historyData: hData } = zoomStateRef.current;
      if (!hData || hData.length === 0 || zStart === null || zEnd === null) return;

      const delta = e.deltaY;
      const currentRange = zEnd - zStart;
      // Use 6% step of total length or at least 1
      const zoomAmount = Math.max(1, Math.floor(hData.length * 0.06));

      if (delta < 0) {
        // Scroll Up: Zoom In
        if (currentRange > 5) {
          const newStart = Math.min(zEnd - 5, zStart + zoomAmount);
          const newEnd = Math.max(zStart + 5, zEnd - zoomAmount);
          setZoomStart(newStart);
          setZoomEnd(newEnd);
          setBrushKey(prev => prev + 1);
        }
      } else {
        // Scroll Down: Zoom Out
        const newStart = Math.max(0, zStart - zoomAmount);
        const newEnd = Math.min(hData.length - 1, zEnd + zoomAmount);
        setZoomStart(newStart);
        setZoomEnd(newEnd);
        setBrushKey(prev => prev + 1);
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  const getActiveChartRef = (chartType) => {
    if (activeTab === 'fablab') {
      if (chartType === 'temp') return fablabTempChartRef;
      if (chartType === 'aq') return fablabAqChartRef;
      if (chartType === 'hum') return fablabHumChartRef;
    } else if (activeTab === 'cleanroom') {
      if (chartType === 'temp') return cleanroomTempChartRef;
      if (chartType === 'hum') return cleanroomHumChartRef;
    }
    return null;
  };

  // Drag-to-Pan (Grab and Drag timeline & vertical scroll) Handlers
  const handleChartMouseDown = (e, chartType) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX ?? e.nativeEvent?.clientX;
      dragStartYRef.current = e.clientY ?? e.nativeEvent?.clientY;
      activeDragChartRef.current = chartType;
      dragDirectionRef.current = null;

      const state = dragStateRef.current;
      dragStartLimitsRef.current = {
        zoomStart: state.zoomStart,
        zoomEnd: state.zoomEnd,
        tempMin: state.tempYMin !== '' ? parseFloat(state.tempYMin) : 10,
        tempMax: state.tempYMax !== '' ? parseFloat(state.tempYMax) : 40,
        humMin: state.humYMin !== '' ? parseFloat(state.humYMin) : 0,
        humMax: state.humYMax !== '' ? parseFloat(state.humYMax) : 100,
        co2Min: state.co2YMin !== '' ? parseFloat(state.co2YMin) : 400,
        co2Max: state.co2YMax !== '' ? parseFloat(state.co2YMax) : 2000,
        tvocMin: state.tvocYMin !== '' ? parseFloat(state.tvocYMin) : 0,
        tvocMax: state.tvocYMax !== '' ? parseFloat(state.tvocYMax) : 300
      };
    }
  };

  // Handle global window mouse events for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingRef.current) {
        const diffX = e.clientX - dragStartXRef.current;
        const diffY = e.clientY - dragStartYRef.current;

        const activeRef = getActiveChartRef(activeDragChartRef.current);
        if (activeRef && activeRef.current) {
          const rect = activeRef.current.getBoundingClientRect();
          const width = rect.width || 500;
          const height = rect.height || 300;
          const limits = dragStartLimitsRef.current;
          const { historyData: hData } = zoomStateRef.current;

          // Establish direction lock
          if (dragDirectionRef.current === null) {
            const totalX = Math.abs(diffX);
            const totalY = Math.abs(diffY);
            if (totalX > 5 || totalY > 5) {
              if (totalX > totalY) {
                dragDirectionRef.current = 'horizontal';
              } else {
                dragDirectionRef.current = 'vertical';
              }
            }
          }

          // 1. Horizontal timeline panning
          if (dragDirectionRef.current === 'horizontal' && limits.zoomStart !== null && limits.zoomEnd !== null && hData && hData.length > 0) {
            const currentRange = limits.zoomEnd - limits.zoomStart;
            const dragPercentageX = diffX / width;
            const shiftX = -Math.round(dragPercentageX * currentRange);

            let newStart = limits.zoomStart + shiftX;
            let newEnd = limits.zoomEnd + shiftX;

            if (newStart < 0) {
              newStart = 0;
              newEnd = Math.min(hData.length - 1, newStart + currentRange);
            } else if (newEnd > hData.length - 1) {
              newEnd = hData.length - 1;
              newStart = Math.max(0, newEnd - currentRange);
            }

            setZoomStart(newStart);
            setZoomEnd(newEnd);
          }

          // 2. Vertical Y-axis bounds panning
          if (dragDirectionRef.current === 'vertical') {
            if (activeDragChartRef.current === 'temp') {
              const range = limits.tempMax - limits.tempMin;
              const shiftY = (diffY / height) * range;
              setTempYMin((limits.tempMin + shiftY).toFixed(1));
              setTempYMax((limits.tempMax + shiftY).toFixed(1));
            } else if (activeDragChartRef.current === 'hum') {
              const range = limits.humMax - limits.humMin;
              const shiftY = (diffY / height) * range;
              setHumYMin((limits.humMin + shiftY).toFixed(1));
              setHumYMax((limits.humMax + shiftY).toFixed(1));
            } else if (activeDragChartRef.current === 'aq') {
              const co2Range = limits.co2Max - limits.co2Min;
              const co2Shift = (diffY / height) * co2Range;
              setCo2YMin((limits.co2Min + co2Shift).toFixed(0));
              setCo2YMax((limits.co2Max + co2Shift).toFixed(0));

              const tvocRange = limits.tvocMax - limits.tvocMin;
              const tvocShift = (diffY / height) * tvocRange;
              setTvocYMin((limits.tvocMin + tvocShift).toFixed(0));
              setTvocYMax((limits.tvocMax + tvocShift).toFixed(0));
            }
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        setIsDragging(false);
        isDraggingRef.current = false;
        dragStartXRef.current = null;
        dragStartYRef.current = null;
        activeDragChartRef.current = null;
        dragDirectionRef.current = null;
        setBrushKey(prev => prev + 1);
      }
      if (isDraggingBrushRef.current) {
        isDraggingBrushRef.current = false;
        setBrushKey(prev => prev + 1);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [activeTab]);

  // Handle native mousedown in the capture phase to bypass Recharts intercepting mouse down events
  useEffect(() => {
    const listeners = [];
    const attachListener = (ref, chartType) => {
      if (ref && ref.current) {
        const el = ref.current;
        const handler = (e) => {
          handleChartMouseDown(e, chartType);
        };
        el.addEventListener('mousedown', handler, { capture: true });
        listeners.push({ el, handler });
      }
    };

    // Attach listeners based on currently active tab
    if (activeTab === 'fablab') {
      attachListener(fablabTempChartRef, 'temp');
      attachListener(fablabHumChartRef, 'hum');
      attachListener(fablabAqChartRef, 'aq');
    } else if (activeTab === 'cleanroom') {
      attachListener(cleanroomTempChartRef, 'temp');
      attachListener(cleanroomHumChartRef, 'hum');
    }

    return () => {
      listeners.forEach(({ el, handler }) => {
        el.removeEventListener('mousedown', handler, { capture: true });
      });
    };
  }, [activeTab]);

  const handleExport = () => {
    const params = [];
    if (startTime) params.push(`start_time=${encodeURIComponent(startTime)}`);
    if (endTime) params.push(`end_time=${encodeURIComponent(endTime)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    
    // Trigger download silently in the same tab to ensure the Toast is visible
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/data/${activeTab}/export${queryString}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("เริ่มดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว", "info");
  };

  const handleOpenPdfModal = async () => {
    setRangeInfo(null);
    setShowPdfModal(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/data/${activeTab}/range-info`, { timeout: 3000 });
      if (res.data) setRangeInfo(res.data);
    } catch (e) {
      console.error("Failed to fetch range info", e);
    }
  };

  const handleTriggerPdfDownload = () => {
    let sTime = '';
    let eTime = '';
    const now = new Date();
    
    const formatLocalISO = (d) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    if (pdfRangeType === 'current_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      sTime = formatLocalISO(firstDay);
      eTime = formatLocalISO(now);
    } else if (pdfRangeType === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      sTime = formatLocalISO(firstDay);
      eTime = formatLocalISO(lastDay);
    } else if (pdfRangeType === '30d') {
      const past = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      sTime = formatLocalISO(past);
      eTime = formatLocalISO(now);
    } else if (pdfRangeType === 'custom') {
      sTime = pdfStart;
      eTime = pdfEnd;
    }

    const params = [];
    if (sTime) params.push(`start_time=${encodeURIComponent(sTime)}`);
    if (eTime) params.push(`end_time=${encodeURIComponent(eTime)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    const downloadUrl = `${API_BASE_URL}/data/${activeTab}/export-pdf${queryString}`;
    
    // Open download in background/new tab safely to prevent browser navigation freezes
    window.open(downloadUrl, '_blank');

    setShowPdfModal(false);
    showToast("กำลังสร้างและดาวน์โหลดไฟล์รายงาน PDF...", "info");
  };

  const getTempDomain = (defaultMin = 10, defaultMax = 40) => {
    const minVal = tempYMin !== '' ? parseFloat(tempYMin) : null;
    const maxVal = tempYMax !== '' ? parseFloat(tempYMax) : null;
    return [
      minVal !== null && !isNaN(minVal) ? minVal : (dataMin => Math.min(defaultMin, Math.floor(dataMin))),
      maxVal !== null && !isNaN(maxVal) ? maxVal : (dataMax => Math.max(defaultMax, Math.ceil(dataMax)))
    ];
  };

  const getHumDomain = () => {
    const minVal = humYMin !== '' ? parseFloat(humYMin) : null;
    const maxVal = humYMax !== '' ? parseFloat(humYMax) : null;
    return [
      minVal !== null && !isNaN(minVal) ? minVal : 0,
      maxVal !== null && !isNaN(maxVal) ? maxVal : 100
    ];
  };

  const getCo2Domain = () => {
    const minVal = co2YMin !== '' ? parseFloat(co2YMin) : null;
    const maxVal = co2YMax !== '' ? parseFloat(co2YMax) : null;
    return [
      minVal !== null && !isNaN(minVal) ? minVal : 'auto',
      maxVal !== null && !isNaN(maxVal) ? maxVal : 'auto'
    ];
  };

  const getTvocDomain = () => {
    const minVal = tvocYMin !== '' ? parseFloat(tvocYMin) : null;
    const maxVal = tvocYMax !== '' ? parseFloat(tvocYMax) : null;
    return [
      minVal !== null && !isNaN(minVal) ? minVal : 'auto',
      maxVal !== null && !isNaN(maxVal) ? maxVal : 'auto'
    ];
  };

  const zoomedData = historyData.slice(zoomStart ?? 0, (zoomEnd ?? historyData.length - 1) + 1);

  return (
    <div className={`theme-bg ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-emerald-500 mb-2 flex items-center">
            <Activity className="mr-3 text-blue-500" />
            Lab Monitoring System
          </h1>
          <div className="flex flex-wrap items-center text-sm gap-2 opacity-80 text-gray-400">
            <div className="relative flex h-2.5 w-2.5 mr-1.5">
              {isSensorActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSensorActive ? 'bg-emerald-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></span>
            </div>
            <span className={isDarkMode ? 'text-gray-300' : 'text-slate-600'}>
              {isSensorActive ? 'Sensor Connected' : 'Sensor Disconnected'}
            </span>
            <span className="mx-1 text-slate-500">•</span>
            <Clock size={14} />
            <span className={isDarkMode ? 'text-gray-300' : 'text-slate-600'}>Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
            <span className="mx-1 text-slate-500">•</span>
            <span className={isDarkMode ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold'}>
              {currentTime.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {currentTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {/* Top Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsKioskMode(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            title="Open Fullscreen TV Kiosk Display Mode"
          >
            <Tv size={16} />
            TV Kiosk Mode
          </button>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`theme-btn ${isDarkMode ? 'dark' : 'light'} p-2.5 rounded-full flex items-center justify-center`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-blue-600" />}
          </button>
        </div>
      </header>

      {/* Filters Card */}
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-5 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between relative z-30 overflow-visible`}>
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          {/* Start Time */}
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1 mb-0.5">
              <Calendar size={12} /> Start Date & Time (24h)
            </span>
            <DateTimePicker24h value={startTime} onChange={setStartTime} isDarkMode={isDarkMode} />
          </div>

          {/* End Time */}
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1 mb-0.5">
              <Calendar size={12} /> End Date & Time (24h)
            </span>
            <DateTimePicker24h value={endTime} onChange={setEndTime} isDarkMode={isDarkMode} />
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto justify-end">
          {/* Reset Filters button */}
          {(startTime || endTime || resolution > 0) && (
            <button
              onClick={() => {
                setStartTime('');
                setEndTime('');
                setResolution(0);
              }}
              className="text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-2 border border-red-500/20 hover:border-red-500/50 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}

          <div className="flex gap-2 flex-wrap md:flex-nowrap">
            {/* Quick selector (only visible if custom dates are not set) */}
            {!startTime && !endTime && (
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className={`theme-input ${isDarkMode ? 'dark' : 'light'}`}
              >
                <option value="1h">Last 1 Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="12h">Last 12 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="3d">Last 3 Days</option>
                <option value="1w">Last 1 Week</option>
                <option value="2w">Last 2 Weeks</option>
                <option value="30d">Last 30 Days</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="all">All Data</option>
              </select>
            )}
            
            <button 
              onClick={handleExport}
              className={`theme-btn ${isDarkMode ? 'dark' : 'light'}`}
            >
              <Download size={16} />
              CSV
            </button>

            <button 
              onClick={handleOpenPdfModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <FileText size={16} />
              Export PDF
            </button>
          </div>
        </div>
      </div>



      {/* Tabs */}
      <div className="flex mb-8">
        <div className={`inline-flex p-1 rounded-xl backdrop-blur-md border transition-all duration-300 ${
          isDarkMode 
            ? 'bg-slate-950/40 border-slate-800/50' 
            : 'bg-slate-100/50 border-slate-200/50'
        }`}>
          <button
            className={`py-2 px-5 font-semibold flex items-center gap-2 rounded-lg transition-all duration-300 text-sm ${
              activeTab === 'fablab' 
                ? isDarkMode 
                  ? 'bg-slate-800/90 text-blue-400 border border-slate-700/50 shadow-lg shadow-blue-500/5'
                  : 'bg-white text-blue-600 border border-slate-200/80 shadow-md'
                : isDarkMode ? 'text-gray-400 hover:text-gray-200 border border-transparent' : 'text-slate-500 hover:text-slate-800 border border-transparent'
            }`}
            onClick={() => setActiveTab('fablab')}
          >
            <Server size={16} />
            Fablab Monitor
          </button>
          <button
            className={`py-2 px-5 font-semibold flex items-center gap-2 rounded-lg transition-all duration-300 text-sm ${
              activeTab === 'cleanroom' 
                ? isDarkMode 
                  ? 'bg-slate-800/90 text-blue-400 border border-slate-700/50 shadow-lg shadow-blue-500/5'
                  : 'bg-white text-blue-600 border border-slate-200/80 shadow-md'
                : isDarkMode ? 'text-gray-400 hover:text-gray-200 border border-transparent' : 'text-slate-500 hover:text-slate-800 border border-transparent'
            }`}
            onClick={() => setActiveTab('cleanroom')}
          >
            <Cpu size={16} />
            Cleanroom Monitor
          </button>
        </div>
      </div>

      {activeTab === 'fablab' ? (
        <>
          {/* Fablab Cards */}
          {(() => {
            const isFablabTempOffline = !isSensorActive || latestData?.temperature === 0.0 || latestData?.temperature === null || latestData?.temperature === undefined;
            const isFablabHumOffline = !isSensorActive || latestData?.humidity === 0.0 || latestData?.humidity === null || latestData?.humidity === undefined;
            const isFablabEco2Offline = !isSensorActive || latestData?.eco2 === 0 || latestData?.eco2 === null || latestData?.eco2 === undefined;
            const isFablabTvocOffline = !isSensorActive || latestData?.tvoc === 0 || latestData?.tvoc === null || latestData?.tvoc === undefined;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                  title="Temperature" 
                  value={latestData?.temperature?.toFixed(1)} 
                  unit="°C" 
                  icon={Thermometer} 
                  theme={colorMap.blue} 
                  isDarkMode={isDarkMode} 
                  isOffline={isFablabTempOffline} 
                  lastValidValue={latestData?.last_valid?.temperature?.toFixed(1)} 
                />
                <StatCard 
                  title="Humidity" 
                  value={latestData?.humidity?.toFixed(1)} 
                  unit="%" 
                  icon={Droplets} 
                  theme={colorMap.blue} 
                  isDarkMode={isDarkMode} 
                  isOffline={isFablabHumOffline} 
                  lastValidValue={latestData?.last_valid?.humidity?.toFixed(1)} 
                />
                <StatCard 
                  title="eCO2" 
                  value={latestData?.eco2} 
                  unit="ppm" 
                  icon={Wind} 
                  theme={getCO2Status(latestData?.eco2).theme} 
                  subtitle={getCO2Status(latestData?.eco2).text} 
                  alert={getCO2Status(latestData?.eco2).desc} 
                  isDarkMode={isDarkMode} 
                  isOffline={isFablabEco2Offline} 
                  lastValidValue={latestData?.last_valid?.eco2} 
                />
                <StatCard 
                  title="TVOC" 
                  value={latestData?.tvoc} 
                  unit="ppb" 
                  icon={Activity} 
                  theme={getTVOCStatus(latestData?.tvoc).theme} 
                  alert={getTVOCStatus(latestData?.tvoc).alert} 
                  isDarkMode={isDarkMode} 
                  isOffline={isFablabTvocOffline} 
                  lastValidValue={latestData?.last_valid?.tvoc} 
                />
              </div>
            );
          })()}

          {/* Fablab Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Temperature Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Temperature History</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} select-none mt-0.5`}>
                    💡 คลิกค้างลากเพื่อเลื่อนแกน | สกรอลเมาส์เพื่อซูมเวลา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">Y-Limit:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={tempYMin} 
                      onChange={(e) => setTempYMin(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={tempYMax} 
                      onChange={(e) => setTempYMax(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Reset view */}
                  {(tempYMin !== '' || tempYMax !== '') && (
                    <button 
                      onClick={() => { setTempYMin(''); setTempYMax(''); }}
                      className="text-[11px] text-red-500 hover:text-red-400 font-semibold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10"
                    >
                      Reset
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200/20 dark:border-slate-800 pl-2">
                    <button 
                      onClick={() => handleCopyChart(fablabTempChartRef, "FabLab Temperature Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 transition-colors"
                      title="Copy graph image to clipboard (คัดลอกรูปภาพกราฟ)"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      onClick={() => handleDownloadChart(fablabTempChartRef, "FabLab_Temperature", "FabLab Temperature Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-500/10 transition-colors"
                      title="Save graph image as PNG (บันทึกรูปกราฟ)"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                ref={fablabTempChartRef} 
                className="h-[330px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={zoomedData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" height={45} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} label={{ value: 'Time (เวลา)', position: 'insideBottom', offset: -5, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 } }} />
                    <YAxis 
                      domain={getTempDomain(10, 40)} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTemp)" dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 6px rgba(59, 130, 246, 0.35))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[40px] w-full select-none mt-2" onMouseDown={() => { isDraggingBrushRef.current = true; }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <XAxis dataKey="displayTime" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="temperature" stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} strokeWidth={1} fill={isDarkMode ? "#3b82f6" : "#cbd5e1"} fillOpacity={0.05} dot={false} isAnimationActive={false} />
                    <Brush 
                      key={`brush-${brushKey}`}
                      dataKey="displayTime" 
                      height={20} 
                      stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} 
                      fill={isDarkMode ? "#1e293b" : "#f1f5f9"}
                      startIndex={zoomStart ?? 0}
                      endIndex={zoomEnd ?? (historyData.length - 1)}
                      onChange={(obj) => {
                        setZoomStart(obj.startIndex);
                        setZoomEnd(obj.endIndex);
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Humidity Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Humidity History</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} select-none mt-0.5`}>
                    💡 คลิกค้างลากเพื่อเลื่อนแกน | สกรอลเมาส์เพื่อซูมเวลา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">Y-Limit:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={humYMin} 
                      onChange={(e) => setHumYMin(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={humYMax} 
                      onChange={(e) => setHumYMax(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Reset view */}
                  {(humYMin !== '' || humYMax !== '') && (
                    <button 
                      onClick={() => { setHumYMin(''); setHumYMax(''); }}
                      className="text-[11px] text-red-500 hover:text-red-400 font-semibold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10"
                    >
                      Reset
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200/20 dark:border-slate-800 pl-2">
                    <button 
                      onClick={() => handleCopyChart(fablabHumChartRef, "FabLab Humidity Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 transition-colors"
                      title="Copy graph image to clipboard (คัดลอกรูปภาพกราฟ)"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      onClick={() => handleDownloadChart(fablabHumChartRef, "FabLab_Humidity", "FabLab Humidity Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-500/10 transition-colors"
                      title="Save graph image as PNG (บันทึกรูปกราฟ)"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                ref={fablabHumChartRef} 
                className="h-[330px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={zoomedData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" height={45} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} label={{ value: 'Time (เวลา)', position: 'insideBottom', offset: -5, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 } }} />
                    <YAxis 
                      domain={getHumDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#10b981" strokeWidth={3} fill="none" dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.35))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[40px] w-full select-none mt-2" onMouseDown={() => { isDraggingBrushRef.current = true; }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <XAxis dataKey="displayTime" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="humidity" stroke={isDarkMode ? "#10b981" : "#cbd5e1"} strokeWidth={1} fill="none" dot={false} isAnimationActive={false} />
                    <Brush 
                      key={`brush-${brushKey}`}
                      dataKey="displayTime" 
                      height={20} 
                      stroke={isDarkMode ? "#10b981" : "#cbd5e1"} 
                      fill={isDarkMode ? "#1e293b" : "#f1f5f9"}
                      startIndex={zoomStart ?? 0}
                      endIndex={zoomEnd ?? (historyData.length - 1)}
                      onChange={(obj) => {
                        setZoomStart(obj.startIndex);
                        setZoomEnd(obj.endIndex);
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Air Quality (eCO2 & TVOC) Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 lg:col-span-2`}>
              <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Air Quality (eCO2 & TVOC)</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} select-none mt-0.5`}>
                    💡 คลิกค้างลากเพื่อเลื่อนแกน | สกรอลเมาส์เพื่อซูมเวลา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* eCO2 Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">eCO2:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={co2YMin} 
                      onChange={(e) => setCo2YMin(e.target.value)} 
                      className={`w-12 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={co2YMax} 
                      onChange={(e) => setCo2YMax(e.target.value)} 
                      className={`w-12 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  {/* TVOC Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">TVOC:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={tvocYMin} 
                      onChange={(e) => setTvocYMin(e.target.value)} 
                      className={`w-12 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={tvocYMax} 
                      onChange={(e) => setTvocYMax(e.target.value)} 
                      className={`w-12 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Reset view */}
                  {(co2YMin !== '' || co2YMax !== '' || tvocYMin !== '' || tvocYMax !== '') && (
                    <button 
                      onClick={() => { setCo2YMin(''); setCo2YMax(''); setTvocYMin(''); setTvocYMax(''); }}
                      className="text-[11px] text-red-500 hover:text-red-400 font-semibold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10"
                    >
                      Reset
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200/20 dark:border-slate-800 pl-2">
                    <button 
                      onClick={() => handleCopyChart(fablabAqChartRef, "FabLab Air Quality (eCO2 & TVOC)")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 transition-colors"
                      title="Copy graph image to clipboard (คัดลอกรูปภาพกราฟ)"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      onClick={() => handleDownloadChart(fablabAqChartRef, "FabLab_AirQuality", "FabLab Air Quality (eCO2 & TVOC)")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-500/10 transition-colors"
                      title="Save graph image as PNG (บันทึกรูปกราฟ)"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                ref={fablabAqChartRef} 
                className="h-[330px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={zoomedData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorCO2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTVOC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" height={45} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} label={{ value: 'Time (เวลา)', position: 'insideBottom', offset: -5, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 } }} />
                    <YAxis 
                      yAxisId="left" 
                      domain={getCo2Domain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'eCO2 (ppm)', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={getTvocDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'TVOC (ppb)', angle: 90, position: 'insideRight', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="eco2" name="eCO2 (ppm)" stroke="#10b981" strokeWidth={3} fill="url(#colorCO2)" dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.3))' }} />
                    <Area yAxisId="right" type="monotone" dataKey="tvoc" name="TVOC (ppb)" stroke="#f59e0b" strokeWidth={3} fill="url(#colorTVOC)" dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.3))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[40px] w-full select-none mt-2" onMouseDown={() => { isDraggingBrushRef.current = true; }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <XAxis dataKey="displayTime" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="eco2" stroke={isDarkMode ? "#10b981" : "#cbd5e1"} strokeWidth={1} fill={isDarkMode ? "#10b981" : "#cbd5e1"} fillOpacity={0.05} dot={false} isAnimationActive={false} />
                    <Brush 
                      key={`brush-${brushKey}`}
                      dataKey="displayTime" 
                      height={20} 
                      stroke={isDarkMode ? "#10b981" : "#cbd5e1"} 
                      fill={isDarkMode ? "#1e293b" : "#f1f5f9"}
                      startIndex={zoomStart ?? 0}
                      endIndex={zoomEnd ?? (historyData.length - 1)}
                      onChange={(obj) => {
                        setZoomStart(obj.startIndex);
                        setZoomEnd(obj.endIndex);
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Cleanroom Cards */}
          {(() => {
            const isCleanroomDhtTempOffline = !isSensorActive || latestData?.dht_temp === 0.0 || latestData?.dht_temp === null || latestData?.dht_temp === undefined;
            const isCleanroomDhtHumOffline = !isSensorActive || latestData?.dht_hum === 0.0 || latestData?.dht_hum === null || latestData?.dht_hum === undefined;
            const isCleanroomDs1TempOffline = !isSensorActive || latestData?.ds1_temp === 0.0 || latestData?.ds1_temp === null || latestData?.ds1_temp === undefined;
            const isCleanroomDs2TempOffline = !isSensorActive || latestData?.ds2_temp === 0.0 || latestData?.ds2_temp === null || latestData?.ds2_temp === undefined;
            const isCleanroomDs3TempOffline = !isSensorActive || latestData?.ds3_temp === 0.0 || latestData?.ds3_temp === null || latestData?.ds3_temp === undefined;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                <StatCard 
                  title="DHT Temp" 
                  value={latestData?.dht_temp?.toFixed(1)} 
                  unit="°C" 
                  icon={Thermometer} 
                  theme={colorMap.blue} 
                  isDarkMode={isDarkMode} 
                  isOffline={isCleanroomDhtTempOffline} 
                  lastValidValue={latestData?.last_valid?.dht_temp?.toFixed(1)} 
                />
                <StatCard 
                  title="DHT Hum" 
                  value={latestData?.dht_hum?.toFixed(1)} 
                  unit="%" 
                  icon={Droplets} 
                  theme={colorMap.blue} 
                  isDarkMode={isDarkMode} 
                  isOffline={isCleanroomDhtHumOffline} 
                  lastValidValue={latestData?.last_valid?.dht_hum?.toFixed(1)} 
                />
                <StatCard 
                  title="Air Inlet" 
                  value={latestData?.ds1_temp?.toFixed(1)} 
                  unit="°C" 
                  icon={Thermometer} 
                  theme={colorMap.cyan} 
                  isDarkMode={isDarkMode} 
                  isOffline={isCleanroomDs1TempOffline} 
                  lastValidValue={latestData?.last_valid?.ds1_temp?.toFixed(1)} 
                />
                <StatCard 
                  title="Optical Table 1" 
                  value={latestData?.ds2_temp?.toFixed(1)} 
                  unit="°C" 
                  icon={Thermometer} 
                  theme={colorMap.cyan} 
                  isDarkMode={isDarkMode} 
                  isOffline={isCleanroomDs2TempOffline} 
                  lastValidValue={latestData?.last_valid?.ds2_temp?.toFixed(1)} 
                />
                <StatCard 
                  title="Optical Table 2" 
                  value={latestData?.ds3_temp?.toFixed(1)} 
                  unit="°C" 
                  icon={Thermometer} 
                  theme={colorMap.cyan} 
                  isDarkMode={isDarkMode} 
                  isOffline={isCleanroomDs3TempOffline} 
                  lastValidValue={latestData?.last_valid?.ds3_temp?.toFixed(1)} 
                />
              </div>
            );
          })()}

          {/* Cleanroom Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cleanroom Temperatures */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Cleanroom Temperatures</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} select-none mt-0.5`}>
                    💡 คลิกค้างลากเพื่อเลื่อนแกน | สกรอลเมาส์เพื่อซูมเวลา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">Y-Limit:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={tempYMin} 
                      onChange={(e) => setTempYMin(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={tempYMax} 
                      onChange={(e) => setTempYMax(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Reset view */}
                  {(tempYMin !== '' || tempYMax !== '') && (
                    <button 
                      onClick={() => { setTempYMin(''); setTempYMax(''); }}
                      className="text-[11px] text-red-500 hover:text-red-400 font-semibold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10"
                    >
                      Reset
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200/20 dark:border-slate-800 pl-2">
                    <button 
                      onClick={() => handleCopyChart(cleanroomTempChartRef, "Cleanroom Temperature Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 transition-colors"
                      title="Copy graph image to clipboard (คัดลอกรูปภาพกราฟ)"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      onClick={() => handleDownloadChart(cleanroomTempChartRef, "CleanRoom_Temperatures", "Cleanroom Temperature Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-500/10 transition-colors"
                      title="Save graph image as PNG (บันทึกรูปกราฟ)"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                ref={cleanroomTempChartRef} 
                className="h-[330px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={zoomedData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" height={45} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} label={{ value: 'Time (เวลา)', position: 'insideBottom', offset: -5, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 } }} />
                    <YAxis 
                      domain={getTempDomain(10, 40)} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="dht_temp" name="DHT Ambient Temp (°C)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 5px rgba(59, 130, 246, 0.35))' }} />
                    <Line type="monotone" dataKey="ds1_temp" name="Air Inlet (°C)" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#22d3ee', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 5px rgba(34, 211, 238, 0.35))' }} />
                    <Line type="monotone" dataKey="ds2_temp" name="Optical Table 1 (°C)" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#06b6d4', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 5px rgba(6, 182, 212, 0.35))' }} />
                    <Line type="monotone" dataKey="ds3_temp" name="Optical Table 2 (°C)" stroke="#0891b2" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0891b2', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 5px rgba(8, 145, 178, 0.35))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[40px] w-full select-none mt-2" onMouseDown={() => { isDraggingBrushRef.current = true; }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <XAxis dataKey="displayTime" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="dht_temp" stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} strokeWidth={1} fill={isDarkMode ? "#3b82f6" : "#cbd5e1"} fillOpacity={0.05} dot={false} isAnimationActive={false} />
                    <Brush 
                      key={`brush-${brushKey}`}
                      dataKey="displayTime" 
                      height={20} 
                      stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} 
                      fill={isDarkMode ? "#1e293b" : "#f1f5f9"}
                      startIndex={zoomStart ?? 0}
                      endIndex={zoomEnd ?? (historyData.length - 1)}
                      onChange={(obj) => {
                        setZoomStart(obj.startIndex);
                        setZoomEnd(obj.endIndex);
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cleanroom Humidity */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <div>
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Cleanroom Humidity</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} select-none mt-0.5`}>
                    💡 คลิกค้างลากเพื่อเลื่อนแกน | สกรอลเมาส์เพื่อซูมเวลา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Y-Axis Limit Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-500/10 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-semibold opacity-70 px-1">Y-Limit:</span>
                    <input 
                      type="number" 
                      placeholder="Min" 
                      value={humYMin} 
                      onChange={(e) => setHumYMin(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                    <span className="text-[10px] opacity-50">-</span>
                    <input 
                      type="number" 
                      placeholder="Max" 
                      value={humYMax} 
                      onChange={(e) => setHumYMax(e.target.value)} 
                      className={`w-14 text-center text-xs py-0.5 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Reset view */}
                  {(humYMin !== '' || humYMax !== '') && (
                    <button 
                      onClick={() => { setHumYMin(''); setHumYMax(''); }}
                      className="text-[11px] text-red-500 hover:text-red-400 font-semibold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10"
                    >
                      Reset
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200/20 dark:border-slate-800 pl-2">
                    <button 
                      onClick={() => handleCopyChart(cleanroomHumChartRef, "Cleanroom Humidity Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 transition-colors"
                      title="Copy graph image to clipboard (คัดลอกรูปภาพกราฟ)"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      onClick={() => handleDownloadChart(cleanroomHumChartRef, "CleanRoom_Humidity", "Cleanroom Humidity Trends")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-500/10 transition-colors"
                      title="Save graph image as PNG (บันทึกรูปกราฟ)"
                    >
                      <Camera size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                ref={cleanroomHumChartRef} 
                className="h-[330px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={zoomedData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorCleanHum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" height={45} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} label={{ value: 'Time (เวลา)', position: 'insideBottom', offset: -5, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 } }} />
                    <YAxis 
                      domain={getHumDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="dht_hum" name="DHT Hum (%)" stroke="#10b981" strokeWidth={3} fill="none" dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} style={{ filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.35))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[40px] w-full select-none mt-2" onMouseDown={() => { isDraggingBrushRef.current = true; }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <XAxis dataKey="displayTime" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="dht_hum" stroke={isDarkMode ? "#10b981" : "#cbd5e1"} strokeWidth={1} fill="none" dot={false} isAnimationActive={false} />
                    <Brush 
                      key={`brush-${brushKey}`}
                      dataKey="displayTime" 
                      height={20} 
                      stroke={isDarkMode ? "#10b981" : "#cbd5e1"} 
                      fill={isDarkMode ? "#1e293b" : "#f1f5f9"}
                      startIndex={zoomStart ?? 0}
                      endIndex={zoomEnd ?? (historyData.length - 1)}
                      onChange={(obj) => {
                        setZoomStart(obj.startIndex);
                        setZoomEnd(obj.endIndex);
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Split Grid for Alerts & Email Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Alert History Section (Left 2/3) */}
        <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 lg:col-span-2 flex flex-col`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-xl font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <AlertTriangle className="text-red-500 animate-pulse" size={24} />
              ประวัติการแจ้งเตือนภัย (Alert History Log)
            </h2>
            {alertLogs.length > 0 && (
              <button
                onClick={handleClearAlertLogs}
                className="text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 border border-red-500/20 hover:border-red-500/50 rounded-lg transition-colors"
              >
                ล้างประวัติ
              </button>
            )}
          </div>

          {alertLogs.length === 0 ? (
            <p className={`text-sm text-center py-8 my-auto ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              ไม่มีประวัติการแจ้งเตือนภัยในระบบ
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-slate-800 text-gray-400' : 'border-slate-200 text-slate-500'} text-xs font-semibold uppercase tracking-wider`}>
                    <th className="py-3 px-4">วัน-เวลา</th>
                    <th className="py-3 px-4">ห้อง</th>
                    <th className="py-3 px-4">เซนเซอร์</th>
                    <th className="py-3 px-4 text-center">ค่าที่วัดได้</th>
                    <th className="py-3 px-4 text-center">เกณฑ์ความปลอดภัย</th>
                    <th className="py-3 px-4">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {alertLogs.map((log) => {
                    const alertDate = new Date(log.timestamp);
                    const timeStr = isNaN(alertDate.getTime()) 
                      ? log.timestamp 
                      : alertDate.toLocaleString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        });

                    const isCleanroom = log.room === 'cleanroom';
                    const roomBadgeColor = isCleanroom 
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20';

                    return (
                      <tr 
                        key={log.id} 
                        className={`border-b ${isDarkMode ? 'border-slate-800/50 hover:bg-slate-800/20' : 'border-slate-100 hover:bg-slate-50/50'} transition-colors`}
                      >
                        <td className={`py-4 px-4 font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>{timeStr}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roomBadgeColor}`}>
                            {isCleanroom ? 'Cleanroom' : 'Fablab'}
                          </span>
                        </td>
                        <td className={`py-4 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{log.sensor}</td>
                        <td className="py-4 px-4 text-center font-bold text-red-500">
                          {log.value.toFixed(1)}{log.sensor.toLowerCase().includes('hum') ? '%' : '°C'}
                        </td>
                        <td className={`py-4 px-4 text-center font-mono text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          {log.sensor.toLowerCase().includes('hum') 
                            ? `< ${log.limit_value}%` 
                            : `${log.limit_value === 40.0 ? '10 - 40°C' : log.limit_value + '°C'}`}
                        </td>
                        <td className={`py-4 px-4 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                          {log.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Email Recipients Section (Right 1/3) */}
        <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 flex flex-col`}>
          <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            <Mail className="text-blue-500" size={24} />
            อีเมลผู้รับแจ้งเตือน (Recipients)
          </h2>
          
          <form onSubmit={handleAddEmail} className="flex gap-2 mb-6">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="กรอกอีเมลใหม่..."
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} flex-grow text-sm py-2`}
              required
            />
            <button
              type="submit"
              className={`theme-btn ${isDarkMode ? 'dark' : 'light'} py-2 px-3 flex items-center gap-1 text-sm font-semibold`}
            >
              <Plus size={16} />
              เพิ่ม
            </button>
          </form>

          {recipientEmails.length === 0 ? (
            <p className={`text-sm text-center py-6 my-auto ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              ไม่มีอีเมลผู้รับแจ้งเตือนที่ลงทะเบียนไว้
            </p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
              {recipientEmails.map((email) => (
                <div 
                  key={email}
                  className={`flex justify-between items-center p-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70' 
                      : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/60'
                  } transition-colors`}
                >
                  <span className={`text-sm font-mono truncate ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`} title={email}>
                    {email}
                  </span>
                  <button
                    onClick={() => handleRemoveEmail(email)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                    title="ลบอีเมลออก"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Threshold Settings Section */}
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 mt-8`}>
        <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          <Sliders className="text-emerald-500" size={24} />
          ตั้งค่าเกณฑ์แจ้งเตือนระบบ (Dynamic Threshold Settings)
        </h2>
        <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
          กำหนดเกณฑ์ความชื้นและอุณหภูมิสำหรับแจ้งเตือนระบบอัตโนมัติ การบันทึกจะมีผลทันทีโดยไม่ต้องรีสตาร์ทเซิร์ฟเวอร์
        </p>

        {/* Active Threshold Status Summary Banner */}
        <div className={`p-3.5 rounded-xl mb-6 border flex flex-wrap gap-3 items-center justify-between text-xs font-semibold transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700/60 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800 shadow-sm'}`}>
          <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
            <CheckCircle2 size={16} /> เกณฑ์ปัจจุบันที่ใช้งานอยู่ (Active System Limits):
          </span>
          <div className="flex flex-wrap gap-2 font-mono">
            <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">Cleanroom Hum: <b>{threshCleanHum}%</b></span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">FabLab Hum: <b>{threshFabHum}%</b></span>
            <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">Max Temp: <b>{threshTempHigh}°C</b></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Droplets size={14} className="text-blue-500" /> Cleanroom Humidity Limit (%)
            </label>
            <input 
              type="number" 
              value={threshCleanHum} 
              onChange={(e) => setThreshCleanHum(e.target.value)} 
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} py-2 text-sm font-semibold`}
              step="0.5"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Droplets size={14} className="text-emerald-500" /> FabLab Humidity Limit (%)
            </label>
            <input 
              type="number" 
              value={threshFabHum} 
              onChange={(e) => setThreshFabHum(e.target.value)} 
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} py-2 text-sm font-semibold`}
              step="0.5"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Thermometer size={14} className="text-red-500" /> Max Temp Safety Limit (°C)
            </label>
            <input 
              type="number" 
              value={threshTempHigh} 
              onChange={(e) => setThreshTempHigh(e.target.value)} 
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} py-2 text-sm font-semibold`}
              step="0.5"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-700/40">
          <button
            onClick={handleSaveThresholds}
            disabled={isSavingThresh}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Save size={16} />
            {isSavingThresh ? 'กำลังบันทึก...' : 'บันทึกเกณฑ์การแจ้งเตือน (Save Settings)'}
          </button>
        </div>
      </div>

      {/* Custom PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} border p-6 max-w-md w-full rounded-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700/50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-500">
                <FileText size={20} />
                ส่งออกรายงาน PDF (Export PDF Report)
              </h3>
              <button onClick={() => setShowPdfModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <p className="text-xs opacity-80 mb-3">เลือกรูปแบบช่วงเวลาที่ต้องการสรุปสถิติและประวัติการแจ้งเตือนภัยลงไฟล์ PDF:</p>

            {rangeInfo && rangeInfo.has_data && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-semibold border flex items-start gap-2.5 transition-all ${isDarkMode ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm'}`}>
                <Info size={16} className="flex-shrink-0 text-blue-500 mt-0.5" />
                <div>
                  <div className="font-bold mb-0.5 text-blue-400">ประวัติข้อมูลที่มีในระบบสำหรับ {activeTab === 'fablab' ? 'FabLab' : 'Cleanroom'}:</div>
                  <div className="font-mono text-[11px] text-emerald-400">📅 {rangeInfo.first_date} ถึง {rangeInfo.last_date}</div>
                  <div className="opacity-70 text-[10px] mt-0.5">(รวมทั้งหมด {rangeInfo.total_records.toLocaleString()} รายการบันทึก)</div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 mb-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-lg border border-slate-700/40 hover:bg-slate-800/30">
                <input type="radio" name="pdfRange" value="current_month" checked={pdfRangeType === 'current_month'} onChange={(e) => setPdfRangeType(e.target.value)} />
                <span>สรุปผลเดือนปัจจุบัน (Current Month)</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-lg border border-slate-700/40 hover:bg-slate-800/30">
                <input type="radio" name="pdfRange" value="last_month" checked={pdfRangeType === 'last_month'} onChange={(e) => setPdfRangeType(e.target.value)} />
                <span>สรุปผลเดือนที่แล้ว (Previous Month)</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-lg border border-slate-700/40 hover:bg-slate-800/30">
                <input type="radio" name="pdfRange" value="30d" checked={pdfRangeType === '30d'} onChange={(e) => setPdfRangeType(e.target.value)} />
                <span>สรุปผลย้อนหลัง 30 วัน (Last 30 Days)</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-lg border border-slate-700/40 hover:bg-slate-800/30">
                <input type="radio" name="pdfRange" value="custom" checked={pdfRangeType === 'custom'} onChange={(e) => setPdfRangeType(e.target.value)} />
                <span>กำหนดช่วงวันเอง (Custom Date Range)</span>
              </label>

              {pdfRangeType === 'custom' && (
                <div className="flex flex-col gap-3 mt-2 pl-6 pt-2 border-t border-slate-700/40">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">เริ่มต้น (24h)</span>
                    <DateTimePicker24h value={pdfStart} onChange={setPdfStart} isDarkMode={isDarkMode} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">สิ้นสุด (24h)</span>
                    <DateTimePicker24h value={pdfEnd} onChange={setPdfEnd} isDarkMode={isDarkMode} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-700/40">
              <button onClick={() => setShowPdfModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">ยกเลิก</button>
              <button onClick={handleTriggerPdfDownload} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer">
                <Download size={14} /> ดาวน์โหลด PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TV Kiosk Mode Render */}
      {isKioskMode && (
        <TVKioskView 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          latestData={latestData}
          isSensorActive={isSensorActive}
          currentTime={currentTime}
          setIsKioskMode={setIsKioskMode}
          threshCleanHum={threshCleanHum}
          threshFabHum={threshFabHum}
          threshTempHigh={threshTempHigh}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      )}

      {/* Dynamic Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-notification ${isDarkMode ? 'dark' : 'light'} ${t.type}`}>
            {t.type === 'success' && <div className="text-emerald-500 font-bold flex-shrink-0">✓</div>}
            {t.type === 'error' && <div className="text-red-500 font-bold flex-shrink-0">✗</div>}
            {t.type === 'info' && <Download className="text-blue-500 flex-shrink-0" size={16} />}
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TVKioskView = ({ activeTab, setActiveTab, latestData, isSensorActive, currentTime, setIsKioskMode, threshCleanHum, threshFabHum, threshTempHigh, isDarkMode, setIsDarkMode }) => {
  const isFab = activeTab === 'fablab';
  const limitHum = isFab ? threshFabHum : threshCleanHum;

  let hasBreach = false;
  if (isFab) {
    if (latestData?.temperature > threshTempHigh || latestData?.humidity > limitHum) hasBreach = true;
  } else {
    if (latestData?.dht_temp > threshTempHigh || latestData?.dht_hum > limitHum || latestData?.ds1_temp > threshTempHigh || latestData?.ds2_temp > threshTempHigh || latestData?.ds3_temp > threshTempHigh) hasBreach = true;
  }

  return (
    <div className={`fixed inset-0 z-50 p-8 flex flex-col justify-between overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {/* Top Header */}
      <div className={`flex justify-between items-center border-b pb-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl ${hasBreach ? 'bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'}`}>
            <Activity size={32} />
          </div>
          <div>
            <h1 className={`text-3xl font-black tracking-wider uppercase bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-blue-400 to-emerald-400' : 'bg-gradient-to-r from-blue-600 to-emerald-600'}`}>
              {isFab ? 'FabLab Environmental Kiosk' : 'Cleanroom Monitoring Kiosk'}
            </h1>
            <p className={`text-sm flex items-center gap-2 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold'}`}>
              <span className={`inline-block w-3 h-3 rounded-full ${isSensorActive ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
              {isSensorActive ? 'REAL-TIME SENSOR STREAM CONNECTED' : 'SENSOR HARDWARE OFFLINE'}
            </p>
          </div>
        </div>

        {/* Action Controls & Theme Toggle */}
        <div className="flex items-center gap-4">
          <div className={`p-1.5 rounded-xl border flex gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-md'}`}>
            <button onClick={() => setActiveTab('cleanroom')} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${!isFab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Cleanroom</button>
            <button onClick={() => setActiveTab('fablab')} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${isFab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>FabLab</button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-yellow-400 hover:bg-slate-800' : 'bg-white border-slate-300 text-blue-600 hover:bg-slate-100 shadow-md'
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
          </button>

          <button onClick={() => setIsKioskMode(false)} className={`p-3.5 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm cursor-pointer ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-md'}`}>
            <Minimize2 size={20} /> Exit Kiosk
          </button>
        </div>
      </div>

      {/* Main Grid Metrics - 4 Corners Layout with Massive Typography */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 my-auto py-6 w-full">
        {isFab ? (
          <>
            <div className={`p-8 lg:p-10 rounded-3xl border backdrop-blur-xl transition-all flex flex-col justify-between min-h-[220px] ${latestData?.temperature > threshTempHigh ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-blue-400' : 'bg-white/90 border-slate-200 text-blue-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Temperature</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.temperature ? latestData.temperature.toFixed(1) : '--'}<span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>°C</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshTempHigh}°C</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border backdrop-blur-xl transition-all flex flex-col justify-between min-h-[220px] ${latestData?.humidity > threshFabHum ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-emerald-400' : 'bg-white/90 border-slate-200 text-emerald-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Relative Humidity</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.humidity ? latestData.humidity.toFixed(1) : '--'}<span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>%</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshFabHum}%</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border transition-all flex flex-col justify-between min-h-[220px] ${isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-purple-400' : 'bg-white/90 border-slate-200 text-purple-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>eCO2 Air Quality</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.eco2 ?? '--'}<span className={`text-4xl lg:text-5xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ppm</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target: &lt; 1000 ppm</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border transition-all flex flex-col justify-between min-h-[220px] ${isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-amber-400' : 'bg-white/90 border-slate-200 text-amber-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TVOC Gas Index</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.tvoc ?? '--'}<span className={`text-4xl lg:text-5xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ppb</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target: &lt; 500 ppb</span>
            </div>
          </>
        ) : (
          <>
            <div className={`p-8 lg:p-10 rounded-3xl border backdrop-blur-xl transition-all flex flex-col justify-between min-h-[220px] ${latestData?.dht_temp > threshTempHigh ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-blue-400' : 'bg-white/90 border-slate-200 text-blue-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ambient Temp (DHT)</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.dht_temp ? latestData.dht_temp.toFixed(1) : '--'}<span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>°C</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshTempHigh}°C</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border backdrop-blur-xl transition-all flex flex-col justify-between min-h-[220px] ${latestData?.dht_hum > threshCleanHum ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-emerald-400' : 'bg-white/90 border-slate-200 text-emerald-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cleanroom Humidity</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.dht_hum ? latestData.dht_hum.toFixed(1) : '--'}<span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>%</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshCleanHum}%</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border transition-all flex flex-col justify-between min-h-[220px] ${latestData?.ds1_temp > threshTempHigh ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-cyan-400' : 'bg-white/90 border-slate-200 text-cyan-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Air Inlet Sensor</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">{latestData?.ds1_temp ? latestData.ds1_temp.toFixed(1) : '--'}<span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>°C</span></div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshTempHigh}°C</span>
            </div>
            <div className={`p-8 lg:p-10 rounded-3xl border transition-all flex flex-col justify-between min-h-[220px] ${((latestData?.ds2_temp + latestData?.ds3_temp)/2) > threshTempHigh ? 'bg-red-500/10 border-red-500/50 text-red-500' : isDarkMode ? 'bg-slate-900/60 border-slate-800/80 text-teal-400' : 'bg-white/90 border-slate-200 text-teal-600 shadow-xl'}`}>
              <span className={`text-base lg:text-lg uppercase font-extrabold tracking-widest block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Optical Table Average</span>
              <div className="text-8xl lg:text-9xl font-black my-4 tracking-tight flex items-baseline">
                {latestData?.ds2_temp && latestData?.ds3_temp ? ((latestData.ds2_temp + latestData.ds3_temp)/2).toFixed(1) : '--'}
                <span className={`text-5xl lg:text-6xl font-normal ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>°C</span>
              </div>
              <span className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limit: Max {threshTempHigh}°C</span>
            </div>
          </>
        )}
      </div>

      {/* Footer Banner */}
      <div className={`flex justify-between items-center border-t pt-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${hasBreach ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className={`text-xl font-bold tracking-wide ${hasBreach ? 'text-red-500' : isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
            {hasBreach ? '⚠️ ALERT BREACH DETECTED — CHECK HVAC / SENSORS' : '✅ SYSTEM ENVIRONMENT STABLE & WITHIN LIMITS'}
          </span>
        </div>
        <div className={`text-right text-lg font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {currentTime.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{currentTime.toLocaleTimeString('th-TH', { hour12: false })}</span>
        </div>
      </div>
    </div>
  );
};

export default App;

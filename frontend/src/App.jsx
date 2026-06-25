import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  LineChart, 
  Line, 
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
  Trash2
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

const StatCard = ({ title, value, unit, icon: Icon, theme, alert, subtitle, isDarkMode }) => {
  const t = theme || colorMap.blue;
  return (
    <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 flex flex-col relative overflow-hidden group border-t-4 border-t-transparent hover:border-t-current ${t.text}`}>
      <div className="absolute -right-6 -top-6 opacity-10 group-hover:scale-110 transition-transform duration-300">
        <Icon size={100} className={t.icon} />
      </div>
      <div className={`flex justify-between items-start mb-4 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
        <h3 className="font-medium">{title}</h3>
        <div className={`p-2 rounded-lg ${t.bg} ${t.icon}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value !== null ? value : '--'}</span>
        <span className={`${isDarkMode ? 'text-gray-400' : 'text-slate-500'} mb-1`}>{unit}</span>
      </div>
      {subtitle && (
        <div className={`mt-3 text-sm font-semibold ${t.text}`}>
          {subtitle}
        </div>
      )}
      {alert && (
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
  if (active && payload && payload.length) {
    return (
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} border p-4 max-w-xs shadow-xl`}>
        <p className={`font-semibold mb-2 border-b pb-2 ${isDarkMode ? 'border-slate-700 text-gray-200' : 'border-slate-200 text-slate-800'}`}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>{entry.name}:</span>
            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const App = () => {
  const [activeTab, setActiveTab] = useState('cleanroom');
  const [latestData, setLatestData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alertLogs, setAlertLogs] = useState([]);
  const [recipientEmails, setRecipientEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [showExportToast, setShowExportToast] = useState(false);

  // Chart Axis Limit States (Custom yMin/yMax settings)
  const [tempYMin, setTempYMin] = useState('');
  const [tempYMax, setTempYMax] = useState('');
  const [humYMin, setHumYMin] = useState('');
  const [humYMax, setHumYMax] = useState('');
  const [co2YMin, setCo2YMin] = useState('');
  const [co2YMax, setCo2YMax] = useState('');
  const [tvocYMin, setTvocYMin] = useState('');
  const [tvocYMax, setTvocYMax] = useState('');

  // Refs for mouse-drag vertical/horizontal panning
  const dragStartXRef = useRef(null);
  const dragStartYRef = useRef(null);
  const dragStartLimitsRef = useRef({});
  const activeDragChartRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Theme, Filter, Clock States
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resolution, setResolution] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Controlled Zoom & Pan States
  const [zoomStart, setZoomStart] = useState(null);
  const [zoomEnd, setZoomEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
      } catch (error) {
        console.error("Error clearing alert logs", error);
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
      alert("กรุณากรอกรูปแบบอีเมลให้ถูกต้อง");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/config/emails`, { email });
      setRecipientEmails(response.data);
      setNewEmail('');
    } catch (error) {
      console.error("Error adding email", error);
      alert(error.response?.data?.detail || "เกิดข้อผิดพลาดในการเพิ่มอีเมล");
    }
  };

  const handleRemoveEmail = async (emailToRemove) => {
    if (window.confirm(`คุณต้องการลบอีเมล ${emailToRemove} ออกจากการแจ้งเตือนใช่หรือไม่?`)) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/config/emails`, {
          params: { email: emailToRemove }
        });
        setRecipientEmails(response.data);
      } catch (error) {
        console.error("Error removing email", error);
        alert(error.response?.data?.detail || "เกิดข้อผิดพลาดในการลบอีเมล");
      }
    }
  };

  const fetchLatestData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/${activeTab}/latest`);
      setLatestData(response.data);
      setIsOnline(true);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching latest data", error);
      if (lastUpdated && (new Date() - lastUpdated) > 30000) {
        setIsOnline(false);
      }
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
      const formattedData = response.data.map(item => {
        const dateStr = item.timestamp ? item.timestamp.replace(' ', 'T') : '';
        const parsedDate = new Date(dateStr);
        const displayTime = isNaN(parsedDate.getTime()) 
          ? (item.timestamp || '') 
          : parsedDate.toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false
            });
            
        return {
          ...item,
          displayTime
        };
      });
      setHistoryData(formattedData);
    } catch (error) {
      console.error("Error fetching history data", error);
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
    fetchHistoryData();
  }, [timeRange, activeTab, startTime, endTime, resolution]);

  // Sync zoom boundaries on history update
  useEffect(() => {
    if (historyData.length > 0) {
      setZoomStart(0);
      setZoomEnd(historyData.length - 1);
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
        }
      } else {
        // Scroll Down: Zoom Out
        const newStart = Math.max(0, zStart - zoomAmount);
        const newEnd = Math.min(hData.length - 1, zEnd + zoomAmount);
        setZoomStart(newStart);
        setZoomEnd(newEnd);
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
      setIsDragging(true);
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX ?? e.nativeEvent?.clientX;
      dragStartYRef.current = e.clientY ?? e.nativeEvent?.clientY;
      activeDragChartRef.current = chartType;

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

          // 1. Horizontal timeline panning
          if (limits.zoomStart !== null && limits.zoomEnd !== null && hData && hData.length > 0) {
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
          if (Math.abs(diffY) > 2) {
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
    window.open(`${API_BASE_URL}/data/${activeTab}/export${queryString}`, '_blank');
    
    setShowExportToast(true);
    setTimeout(() => {
      setShowExportToast(false);
    }, 3000);
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
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={isDarkMode ? 'text-gray-300' : 'text-slate-600'}>{isOnline ? 'System Online' : 'System Offline'}</span>
            <span className="mx-1 text-slate-500">•</span>
            <Clock size={14} />
            <span className={isDarkMode ? 'text-gray-300' : 'text-slate-600'}>Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
            <span className="mx-1 text-slate-500">•</span>
            <span className={isDarkMode ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold'}>
              {currentTime.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {currentTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {/* Toggle Mode */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`theme-btn ${isDarkMode ? 'dark' : 'light'} p-2.5 rounded-full flex items-center justify-center`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-blue-600" />}
        </button>
      </header>

      {/* Filters Card */}
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-5 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between`}>
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          {/* Start Time */}
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
              <Calendar size={12} /> Start Date & Time
            </span>
            <input 
              type="datetime-local" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full md:w-48`}
            />
          </div>

          {/* End Time */}
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
              <Calendar size={12} /> End Date & Time
            </span>
            <input 
              type="datetime-local" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full md:w-48`}
            />
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
              <Sliders size={12} /> Resolution
            </span>
            <select
              value={resolution}
              onChange={(e) => setResolution(parseInt(e.target.value))}
              className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full md:w-36`}
            >
              <option value={0}>Auto</option>
              <option value={1}>1 Minute</option>
              <option value={3}>3 Minutes</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>1 Hour</option>
            </select>
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

          <div className="flex gap-2">
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
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Chart Settings Accordion / Panel */}
      <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-5 mb-8`}>
        <details className="group">
          <summary className={`flex justify-between items-center font-semibold cursor-pointer list-none ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>
            <span className="flex items-center gap-2">
              <Sliders size={18} className="text-blue-500" />
              Chart Axis Limit Settings (กำหนดขอบเขตแกน Y)
            </span>
            <span className="transition group-open:rotate-180">
              <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
            </span>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-5 pt-5 border-t border-slate-700/50">
            {/* Temp Limits */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
                <Thermometer size={14} className="text-blue-500" /> Temperature Y-Axis (°C)
              </span>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  placeholder="Min (Auto)" 
                  value={tempYMin} 
                  onChange={(e) => setTempYMin(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
                <span className="text-xs opacity-50">to</span>
                <input 
                  type="number" 
                  placeholder="Max (Auto)" 
                  value={tempYMax} 
                  onChange={(e) => setTempYMax(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
              </div>
            </div>
            
            {/* Hum Limits */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
                <Droplets size={14} className="text-emerald-500" /> Humidity Y-Axis (%)
              </span>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  placeholder="Min (Auto)" 
                  value={humYMin} 
                  onChange={(e) => setHumYMin(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
                <span className="text-xs opacity-50">to</span>
                <input 
                  type="number" 
                  placeholder="Max (Auto)" 
                  value={humYMax} 
                  onChange={(e) => setHumYMax(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
              </div>
            </div>

            {/* eCO2 Limits */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
                <Wind size={14} className="text-purple-500" /> eCO2 Y-Axis (ppm)
              </span>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  placeholder="Min (Auto)" 
                  value={co2YMin} 
                  onChange={(e) => setCo2YMin(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
                <span className="text-xs opacity-50">to</span>
                <input 
                  type="number" 
                  placeholder="Max (Auto)" 
                  value={co2YMax} 
                  onChange={(e) => setCo2YMax(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
              </div>
            </div>

            {/* TVOC Limits */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
                <Activity size={14} className="text-orange-500" /> TVOC Y-Axis (ppb)
              </span>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  placeholder="Min (Auto)" 
                  value={tvocYMin} 
                  onChange={(e) => setTvocYMin(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
                <span className="text-xs opacity-50">to</span>
                <input 
                  type="number" 
                  placeholder="Max (Auto)" 
                  value={tvocYMax} 
                  onChange={(e) => setTvocYMax(e.target.value)} 
                  className={`theme-input ${isDarkMode ? 'dark' : 'light'} w-full text-xs py-1.5`}
                />
              </div>
            </div>
          </div>
          {(tempYMin || tempYMax || humYMin || humYMax || co2YMin || co2YMax || tvocYMin || tvocYMax) && (
            <div className="flex justify-end mt-4">
              <button 
                onClick={() => {
                  setTempYMin(''); setTempYMax('');
                  setHumYMin(''); setHumYMax('');
                  setCo2YMin(''); setCo2YMax('');
                  setTvocYMin(''); setTvocYMax('');
                }}
                className="text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 border border-red-500/20 hover:border-red-500/50 rounded-lg transition-colors"
              >
                Reset Y-Limits
              </button>
            </div>
          )}
        </details>
      </div>

      {/* Tabs */}
      <div className={`flex gap-4 mb-8 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          className={`pb-4 px-2 font-medium flex items-center gap-2 transition-colors ${
            activeTab === 'fablab' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('fablab')}
        >
          <Server size={18} />
          Fablab Monitor
        </button>
        <button
          className={`pb-4 px-2 font-medium flex items-center gap-2 transition-colors ${
            activeTab === 'cleanroom' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('cleanroom')}
        >
          <Cpu size={18} />
          Cleanroom Monitor
        </button>
      </div>

      {activeTab === 'fablab' ? (
        <>
          {/* Fablab Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Temperature" value={latestData?.temperature?.toFixed(1)} unit="°C" icon={Thermometer} theme={colorMap.blue} isDarkMode={isDarkMode} />
            <StatCard title="Humidity" value={latestData?.humidity?.toFixed(1)} unit="%" icon={Droplets} theme={colorMap.blue} isDarkMode={isDarkMode} />
            <StatCard title="eCO2" value={latestData?.eco2} unit="ppm" icon={Wind} theme={getCO2Status(latestData?.eco2).theme} subtitle={getCO2Status(latestData?.eco2).text} alert={getCO2Status(latestData?.eco2).desc} isDarkMode={isDarkMode} />
            <StatCard title="TVOC" value={latestData?.tvoc} unit="ppb" icon={Activity} theme={getTVOCStatus(latestData?.tvoc).theme} alert={getTVOCStatus(latestData?.tvoc).alert} isDarkMode={isDarkMode} />
          </div>

          {/* Fablab Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Temperature Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Temperature History</h3>
              <div 
                ref={fablabTempChartRef} 
                className="h-[380px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historyData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={getTempDomain(10, 40)} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Brush 
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
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Humidity Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Humidity History</h3>
              <div 
                ref={fablabHumChartRef} 
                className="h-[380px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historyData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={getHumDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Brush 
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
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Air Quality (eCO2 & TVOC) Chart */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6 lg:col-span-2`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Air Quality (eCO2 & TVOC)</h3>
              <div 
                ref={fablabAqChartRef} 
                className="h-[380px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historyData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis 
                      yAxisId="left" 
                      domain={getCo2Domain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'eCO2 (ppm)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={getTvocDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'TVOC (ppb)', angle: 90, position: 'insideRight', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="eco2" name="eCO2 (ppm)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="tvoc" name="TVOC (ppb)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Brush 
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
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Cleanroom Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            <StatCard title="DHT Temp" value={latestData?.dht_temp?.toFixed(1)} unit="°C" icon={Thermometer} theme={colorMap.blue} isDarkMode={isDarkMode} />
            <StatCard title="DHT Hum" value={latestData?.dht_hum?.toFixed(1)} unit="%" icon={Droplets} theme={colorMap.blue} isDarkMode={isDarkMode} />
            <StatCard title="Air Inlet" value={latestData?.ds1_temp?.toFixed(1)} unit="°C" icon={Thermometer} theme={colorMap.cyan} isDarkMode={isDarkMode} />
            <StatCard title="Optical Table 1" value={latestData?.ds2_temp?.toFixed(1)} unit="°C" icon={Thermometer} theme={colorMap.cyan} isDarkMode={isDarkMode} />
            <StatCard title="Optical Table 2" value={latestData?.ds3_temp?.toFixed(1)} unit="°C" icon={Thermometer} theme={colorMap.cyan} isDarkMode={isDarkMode} />
          </div>

          {/* Cleanroom Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cleanroom Temperatures */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Cleanroom Temperatures</h3>
              <div 
                ref={cleanroomTempChartRef} 
                className="h-[380px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historyData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={getTempDomain(10, 40)} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="dht_temp" name="DHT Ambient Temp (°C)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="ds1_temp" name="Air Inlet (°C)" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#22d3ee', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="ds2_temp" name="Optical Table 1 (°C)" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#06b6d4', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="ds3_temp" name="Optical Table 2 (°C)" stroke="#0891b2" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0891b2', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Brush 
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
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cleanroom Humidity */}
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Cleanroom Humidity</h3>
              <div 
                ref={cleanroomHumChartRef} 
                className="h-[380px] w-full select-none"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={historyData} 
                    margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={getHumDomain()} 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"} 
                      tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                      tickLine={false} 
                      axisLine={false}
                      label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="dht_hum" name="DHT Hum (%)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    <Brush 
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
                  </LineChart>
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
      {/* Export Toast Notification */}
      {showExportToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-500/20 font-medium animate-pulse">
          <Download size={20} />
          <span>Exporting CSV data... Your download has started!</span>
        </div>
      )}
    </div>
  );
};

export default App;

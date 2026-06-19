import React, { useState, useEffect } from 'react';
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
  Sliders
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
  const [activeTab, setActiveTab] = useState('fablab');
  const [latestData, setLatestData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Added States
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resolution, setResolution] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      const formattedData = response.data.map(item => ({
        ...item,
        displayTime: new Date(item.timestamp).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false
        })
      }));
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
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLatestData();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, lastUpdated]);

  useEffect(() => {
    fetchHistoryData();
  }, [timeRange, activeTab, startTime, endTime, resolution]);

  const handleExport = () => {
    const params = [];
    if (startTime) params.push(`start_time=${encodeURIComponent(startTime)}`);
    if (endTime) params.push(`end_time=${encodeURIComponent(endTime)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    window.open(`${API_BASE_URL}/data/${activeTab}/export${queryString}`, '_blank');
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
                <option value="24h">Last 24 Hours</option>
                <option value="30d">Last 30 Days</option>
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
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Temperature & Humidity</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" domain={[10, 40]} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" domain={[0, 100]} orientation="right" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Brush dataKey="displayTime" height={20} stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} fill={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>Air Quality (eCO2 & TVOC)</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="eco2" name="eCO2 (ppm)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="tvoc" name="TVOC (ppb)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f59e0b', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Brush dataKey="displayTime" height={20} stroke={isDarkMode ? "#10b981" : "#cbd5e1"} fill={isDarkMode ? "#1e293b" : "#f1f5f9"} />
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
            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>DHT22 Ambient Environment</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" domain={[10, 40]} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" domain={[0, 100]} orientation="right" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="dht_temp" name="DHT Temp (°C)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="dht_hum" name="DHT Hum (%)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Brush dataKey="displayTime" height={20} stroke={isDarkMode ? "#3b82f6" : "#cbd5e1"} fill={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`theme-card ${isDarkMode ? 'dark' : 'light'} p-6`}>
              <h3 className={`text-lg font-medium mb-6 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>DS18B20 Multi-Point Temperatures</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="displayTime" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis domain={[10, 40]} stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="ds1_temp" name="Air Inlet (°C)" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#22d3ee', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="ds2_temp" name="Optical Table 1 (°C)" stroke="#06b6d4" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#06b6d4', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="ds3_temp" name="Optical Table 2 (°C)" stroke="#0891b2" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0891b2', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} />
                    <Brush dataKey="displayTime" height={20} stroke={isDarkMode ? "#22d3ee" : "#cbd5e1"} fill={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;

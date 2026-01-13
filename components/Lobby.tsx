import React, { useState, useEffect } from 'react';
import { Copy, ArrowRight, Loader2, AlertCircle, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useGameStore, SERVER_LIST, saveCustomServerUrl } from '../store/gameStore';

export const Lobby: React.FC = () => {
  const { joinRoom, disconnect, myId, status, errorMessage, diagnostics, pingServer } = useGameStore();
  const [hostIdInput, setHostIdInput] = useState('');
  const [mode, setMode] = useState<'SELECT' | 'HOST' | 'JOIN' | 'SETTINGS'>('SELECT');
  const [customServer, setCustomServer] = useState(() => {
    try {
      return localStorage.getItem('bridge_custom_server') || '';
    } catch {
      return '';
    }
  });
  const [useCustomServer, setUseCustomServer] = useState(false);

  // 定期ping服务器测量延迟
  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(() => {
        pingServer();
      }, 10000); // 每10秒ping一次
      return () => clearInterval(interval);
    }
  }, [status, pingServer]);

  const copyId = () => {
    navigator.clipboard.writeText(myId);
    alert('已复制ID！');
  };

  const handleHost = async () => {
    setMode('HOST');
    const roomId = `room-${Math.random().toString(36).slice(2, 9)}`;
    const serverUrl = useCustomServer && customServer ? customServer : undefined;
    joinRoom(roomId, serverUrl);
  };

  const handleJoin = async () => {
    if (!hostIdInput) return;
    const serverUrl = useCustomServer && customServer ? customServer : undefined;
    joinRoom(hostIdInput.trim(), serverUrl);
  };

  const handleBack = () => {
    disconnect();
    setMode('SELECT');
  };

  const handleSaveSettings = () => {
    if (customServer) {
      saveCustomServerUrl(customServer);
    }
    setMode('SELECT');
  };

  // 连接状态指示器
  const ConnectionStatus = () => {
    if (!diagnostics.serverUrl) return null;

    const getLatencyColor = (latency: number | null) => {
      if (latency === null) return 'text-gray-400';
      if (latency < 100) return 'text-green-400';
      if (latency < 300) return 'text-yellow-400';
      return 'text-red-400';
    };

    const getLatencyText = (latency: number | null) => {
      if (latency === null) return '测量中...';
      if (latency < 100) return `${latency}ms (优秀)`;
      if (latency < 300) return `${latency}ms (良好)`;
      return `${latency}ms (较慢)`;
    };

    return (
      <div className="bg-black/20 rounded-lg p-3 mb-4 text-sm">
        <div className="flex items-center gap-2 mb-2">
          {status === 'connected' ? (
            <Wifi className="text-green-400" size={16} />
          ) : status === 'reconnecting' ? (
            <RefreshCw className="animate-spin text-yellow-400" size={16} />
          ) : (
            <WifiOff className="text-red-400" size={16} />
          )}
          <span className="text-gray-300">
            {status === 'connected' ? '已连接' : status === 'reconnecting' ? `重连中 (${diagnostics.reconnectAttempts})` : '未连接'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>
            <span className="text-gray-500">延迟: </span>
            <span className={getLatencyColor(diagnostics.latency)}>
              {getLatencyText(diagnostics.latency)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">传输: </span>
            <span>{diagnostics.transport || 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  // 设置页面
  if (mode === 'SETTINGS') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-green-900">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20 text-white">
          <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center gap-2">
            <Settings size={24} />
            服务器设置
          </h2>

          <div className="space-y-4">
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3">默认服务器</h3>
              <div className="space-y-2">
                {SERVER_LIST.filter(s => s.url).map((server, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      id={`server-${idx}`}
                      name="server"
                      checked={!useCustomServer && idx === 0}
                      onChange={() => setUseCustomServer(false)}
                      className="accent-yellow-500"
                    />
                    <label htmlFor={`server-${idx}`} className="flex-1">
                      <span className="text-white">{server.name}</span>
                      <span className="text-gray-400 text-xs ml-2">({server.region})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  id="custom-server"
                  name="server"
                  checked={useCustomServer}
                  onChange={() => setUseCustomServer(true)}
                  className="accent-yellow-500"
                />
                <label htmlFor="custom-server" className="font-semibold">自定义服务器</label>
              </div>
              <input
                type="text"
                placeholder="https://your-server.com"
                value={customServer}
                onChange={(e) => {
                  setCustomServer(e.target.value);
                  setUseCustomServer(true);
                }}
                className="w-full bg-black/30 border border-white/30 rounded-lg p-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-gray-400 mt-2">
                提示：如果默认服务器连接不稳定，可以部署自己的Socket.io服务器。
              </p>
            </div>

            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 text-sm">
              <h4 className="font-semibold text-blue-300 mb-2">跨地区连接提示</h4>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>1. 如果新加坡-中国连接不稳定，建议部署一个香港或新加坡的服务器</li>
                <li>2. 推荐使用 Railway、Render 或 Fly.io 免费部署</li>
                <li>3. 服务器代码见项目根目录的 server.js 示例</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setMode('SELECT')}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition"
            >
              取消
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 主选择页面
  if (mode === 'SELECT') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-green-900">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
          <h1 className="text-4xl font-bold text-center mb-2 text-white">Bridge Duel</h1>
          <p className="text-center text-gray-200 mb-8">1v1 Online P2P Bridge</p>

          {useCustomServer && customServer && (
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-2 mb-4 text-center text-sm text-blue-200">
              使用自定义服务器
            </div>
          )}

          <div className="space-y-4">
            <button onClick={handleHost} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl text-xl transition shadow-lg">
              创建游戏
            </button>
            <button onClick={() => setMode('JOIN')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-xl transition shadow-lg">
              加入游戏
            </button>
            <button
              onClick={() => setMode('SETTINGS')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <Settings size={20} />
              服务器设置
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 创建游戏（等待对手）
  if (mode === 'HOST') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-green-900">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">等待玩家加入</h2>

          {status === 'connecting' && <Loader2 className="animate-spin mx-auto h-8 w-8 mb-4" />}

          {errorMessage && (
            <div className="bg-red-500/80 p-3 rounded mb-4 flex items-center gap-2 text-sm text-left">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {myId && status !== 'error' && (
            <div className="bg-black/30 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-300 mb-2">将此ID发送给你的朋友:</p>
              <div className="flex items-center gap-2 bg-white/10 p-2 rounded">
                <code className="flex-1 text-lg font-mono text-yellow-300 overflow-hidden text-ellipsis">{myId}</code>
                <button onClick={copyId} className="p-2 hover:bg-white/10 rounded"><Copy size={20}/></button>
              </div>
            </div>
          )}

          <ConnectionStatus />

          <div className="flex items-center justify-center gap-2 text-gray-400">
            {status === 'connected' ? (
              <span className="text-green-400 font-bold">已连接！游戏开始...</span>
            ) : status === 'reconnecting' ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span className="text-yellow-400">重新连接中...</span>
              </>
            ) : status === 'error' ? (
              <span className="text-red-400">连接失败</span>
            ) : (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>等待连接...</span>
              </>
            )}
          </div>

          <button onClick={handleBack} className="mt-8 text-sm text-gray-400 hover:text-white underline">取消</button>
        </div>
      </div>
    );
  }

  // 加入游戏
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-green-900">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20 text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">加入游戏</h2>

        {errorMessage && (
          <div className="bg-red-500/80 p-3 rounded mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16}/> {errorMessage}
          </div>
        )}

        {status === 'reconnecting' && (
          <div className="bg-yellow-500/80 p-3 rounded mb-4 flex items-center gap-2 text-sm">
            <RefreshCw className="animate-spin" size={16}/> 重新连接中...
          </div>
        )}

        <input
          type="text"
          placeholder="粘贴房间ID"
          value={hostIdInput}
          onChange={(e) => setHostIdInput(e.target.value)}
          className="w-full bg-black/30 border border-white/30 rounded-lg p-4 text-white placeholder-gray-400 mb-4 font-mono text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />

        {(status === 'connected' || status === 'connecting') && <ConnectionStatus />}

        <button
          onClick={handleJoin}
          disabled={!hostIdInput || status === 'connecting'}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-xl transition shadow-lg flex items-center justify-center gap-2"
        >
          {status === 'connecting' ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          连接
        </button>

        <button onClick={handleBack} className="w-full mt-4 text-gray-400 hover:text-white">返回</button>
      </div>
    </div>
  );
};

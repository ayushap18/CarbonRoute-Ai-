import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Sparkles, Cloud, Truck, Gauge, Fuel, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useFleet } from '../context/FleetContext';
import type { ChatMessage } from '../types';

const QUICK_QUERIES = [
  { category: 'Emissions', queries: ['Which truck emits most CO2?', 'Total fleet emissions today?', 'Why did emissions spike?'] },
  { category: 'Performance', queries: ['Best performing truck?', 'Fleet green score breakdown?', 'Which trucks are idling?'] },
  { category: 'Strategy', queries: ['How to reduce fleet CO2?', 'Optimal load distribution?', 'Route optimization tips?'] },
];

export default function ChatPage() {
  const { trucks, summary, alerts } = useFleet();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: 'Hello! I\'m your Fleet AI Analyst powered by RAG. Ask me about emissions, truck performance, route efficiency, or sustainability insights. I have access to the live MRV ledger data.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await api.queryRAG(q);
      setMessages(prev => [...prev, { role: 'ai', text: r.answer, citations: r.citations }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process that query right now. Please check if the backend is running.' }]);
    }
    setLoading(false);
  }, [input, loading]);

  return (
    <div className="flex-1 flex overflow-hidden animate-page-enter">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        <div className="px-6 py-3 border-b border-white/[0.04] flex items-center gap-2 shrink-0">
          <Bot size={18} className="text-primary" />
          <h2 className="text-white text-lg font-bold">Fleet AI Analyst</h2>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold ml-2">RAG-Powered</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[70%] px-4 py-3 rounded-xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary/20 text-white rounded-br-sm'
                  : 'bg-surface-card text-slate-300 rounded-bl-sm border border-white/[0.04]'
              }`}>
                {msg.role === 'ai' && <Sparkles size={10} className="inline text-primary mr-1.5 mb-0.5" />}
                {msg.text}
                {msg.citations && msg.citations.length > 0 && (
                  <p className="text-[9px] text-primary/50 mt-2 font-mono border-t border-white/[0.04] pt-1.5">Sources: {msg.citations.join(', ')}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-card px-4 py-3 rounded-xl rounded-bl-sm border border-white/[0.04] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Queries */}
        <div className="px-6 pb-2 flex flex-wrap gap-1.5">
          {QUICK_QUERIES.flatMap(cat => cat.queries).slice(0, 6).map(q => (
            <button key={q} onClick={() => sendMessage(q)}
              className="text-[10px] text-primary/70 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg cursor-pointer transition-colors btn-press">
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.04] shrink-0">
          <div className="flex gap-3">
            <input
              className="flex-1 bg-surface-dark border border-white/[0.06] rounded-lg text-[13px] text-white px-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-slate-600"
              placeholder="Ask about fleet emissions, performance, or sustainability..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={() => sendMessage()} disabled={loading}
              className="bg-primary hover:bg-primary-dark text-black px-4 rounded-lg cursor-pointer btn-press disabled:opacity-40 transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Context Sidebar */}
      <div className="w-[280px] shrink-0 border-l border-white/[0.04] bg-surface-darker overflow-y-auto">
        <div className="p-4 border-b border-white/[0.04]">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-3">Live Fleet Context</p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Fleet Score', value: `${summary?.avg_green_score?.toFixed(0) ?? '0'}/100`, icon: <Gauge size={12} />, color: 'text-primary' },
              { label: 'Total CO2 Today', value: `${summary?.total_co2_today?.toFixed(1) ?? '0'} kg`, icon: <Cloud size={12} />, color: 'text-primary' },
              { label: 'Active Trucks', value: `${summary?.active_trucks ?? 0}/${summary?.total_trucks ?? 0}`, icon: <Truck size={12} />, color: 'text-accent-blue' },
              { label: 'Active Alerts', value: `${summary?.active_alerts ?? 0}`, icon: <AlertTriangle size={12} />, color: summary?.active_alerts ? 'text-accent-red' : 'text-primary' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-surface-dark/50 rounded-lg px-3 py-2 border border-white/[0.04]">
                <span className={item.color}>{item.icon}</span>
                <div className="flex-1">
                  <p className="text-[8px] text-slate-500 uppercase">{item.label}</p>
                  <p className="text-[12px] text-white font-bold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-white/[0.04]">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-3">Truck Status</p>
          <div className="flex flex-col gap-1.5">
            {trucks.slice(0, 6).map(t => (
              <div key={t.truck_id} className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${t.green_badge === 'GREEN' ? 'bg-primary' : t.green_badge === 'YELLOW' ? 'bg-accent-yellow' : 'bg-accent-red'}`} />
                <span className="text-white font-bold">{t.truck_id}</span>
                <span className="text-slate-500">{t.green_score}</span>
                <span className="ml-auto text-slate-500 tabular-nums">{t.co2_rate_kgph.toFixed(1)} kg/h</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-3">Query Categories</p>
          <div className="flex flex-col gap-2.5">
            {QUICK_QUERIES.map((cat, i) => (
              <div key={i}>
                <p className="text-[10px] text-slate-400 font-semibold mb-1">{cat.category}</p>
                <div className="flex flex-col gap-1">
                  {cat.queries.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-left text-[10px] text-slate-500 hover:text-primary px-2 py-1 rounded hover:bg-primary/5 cursor-pointer transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

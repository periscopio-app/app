"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface SystemTask {
  id: string;
  title: string;
  status: "pronta" | "em_andamento" | "a_fazer";
  category: string;
  priority?: string;
  description?: string;
}

interface SyncSummary {
  total: number;
  completedCount: number;
  inProgressCount: number;
  todoCount: number;
  tasks: SystemTask[];
  syncedAt: string;
}

export default function NotionTasksWidget() {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = "";

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiUrl}/api/notion/sync`);
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
      } else {
        setError(data.error || "Erro ao obter tarefas do Notion.");
      }
    } catch (err: any) {
      setError("Não foi possível conectar à API de sincronização.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div className="bg-white border border-[#E1E9ED] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E1E9ED] pb-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-[#14202B] flex items-center gap-2">
            <span>📋 Board de Tarefas do Sistema (Notion Sync)</span>
          </h2>
          <p className="text-xs text-[#5B6B78] mt-1">
            Sincronização com a Board oficial do Periscópio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E1E9ED] hover:bg-[#F0F9FC] text-[#3D6B6B] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </button>
          <a
            href="https://app.notion.com/p/3de22e9df44c8010a6d3e984b965654a?v=2f400e2b472342b49f2312201b05b36b"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#682880]/10 text-[#682880] hover:bg-[#682880]/20 transition-all"
          >
            <span>Abrir no Notion</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Counter Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-[#EAF6F0] border border-[#CFE8DB] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#1E5A41] text-xs font-bold uppercase mb-1">
              <CheckCircle2 className="w-4 h-4 text-[#2F7D5B]" />
              <span>Concluídas</span>
            </div>
            <p className="text-2xl font-extrabold text-[#1E5A41]">{summary.completedCount}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FBF0D0] border border-[#F2D27A] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#7A5A06] text-xs font-bold uppercase mb-1">
              <Clock className="w-4 h-4 text-[#E0A820]" />
              <span>Em Andamento</span>
            </div>
            <p className="text-2xl font-extrabold text-[#7A5A06]">{summary.inProgressCount}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F0F9FC] border border-[#DDF0F6] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#14566D] text-xs font-bold uppercase mb-1">
              <AlertCircle className="w-4 h-4 text-[#1F7390]" />
              <span>A Fazer</span>
            </div>
            <p className="text-2xl font-extrabold text-[#14566D]">{summary.todoCount}</p>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {summary?.tasks.map((task) => {
          let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
          let label = "A Fazer";
          if (task.status === "pronta") {
            badgeClass = "bg-[#EAF6F0] text-[#1E5A41] border-[#CFE8DB]";
            label = "Concluída";
          } else if (task.status === "em_andamento") {
            badgeClass = "bg-[#FBF0D0] text-[#7A5A06] border-[#F2D27A]";
            label = "Em Andamento";
          }

          return (
            <div
              key={task.id}
              className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#E1E9ED] bg-[#F6F9FB]/50 hover:bg-white transition-all"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#14202B] leading-snug">{task.title}</p>
                {task.description && (
                  <p className="text-[11px] text-[#5B6B78]">{task.description}</p>
                )}
              </div>
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${badgeClass} shrink-0`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

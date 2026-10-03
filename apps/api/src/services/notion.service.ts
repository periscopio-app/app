/**
 * Serviço de Integração com a API do Notion para Sincronização de Tarefas do Sistema.
 * ID do Database / Board: 3de22e9df44c8010a6d3e984b965654a
 */

export interface SystemTask {
  id: string;
  title: string;
  status: "pronta" | "em_andamento" | "a_fazer";
  category: "autenticacao" | "triagem" | "prontuario" | "onboarding" | "governanca" | "lms" | "outros";
  priority?: "alta" | "media" | "baixa";
  description?: string;
  completedAt?: string;
}

export interface NotionSyncResult {
  total: number;
  completedCount: number;
  inProgressCount: number;
  todoCount: number;
  tasks: SystemTask[];
  syncedAt: string;
}

const DEFAULT_DATABASE_ID = "3de22e9df44c8010a6d3e984b965654a";

/**
 * Mapeamento inicial das tarefas do sistema Periscópio com base na auditoria
 * da codebase e nas especificações da Board do Notion.
 */
export const KNOWN_SYSTEM_TASKS: SystemTask[] = [
  // --- PRONTAS ---
  {
    id: "task-001",
    title: "Layout Padrão Claro & Componente Hero com Animações Motion + Three.js",
    status: "pronta",
    category: "outros",
    priority: "alta",
    description: "Layout #F6F9FB, Hero.tsx com imagem grande e ThreeBackground.tsx integrado com particles WebGL.",
  },
  {
    id: "task-002",
    title: "Integração API do Google Login no Backend (Better Auth) e Frontend",
    status: "pronta",
    category: "autenticacao",
    priority: "alta",
    description: "Configuração socialProviders.google em Fastify/Better Auth e botões de login social nas páginas de login.",
  },
  {
    id: "task-003",
    title: "Isolamento Multi-tenant no Postgres (Neon) com RLS por tenant_id",
    status: "pronta",
    category: "governanca",
    priority: "alta",
    description: "Tabelas tenants, schools, users com RLS ativado e suporte a RBAC com 9 papéis de sistema.",
  },
  {
    id: "task-004",
    title: "Fichas de Triagem do Professor e Algoritmos SNAP-IV & ABC",
    status: "pronta",
    category: "triagem",
    priority: "alta",
    description: "Submissão de observações, cálculo automatizado de escores SNAP-IV e ABC e trava de 120 dias de janela terapêutica.",
  },
  {
    id: "task-005",
    title: "Estrutura do Prontuário Multidisciplinar Delegado",
    status: "pronta",
    category: "prontuario",
    priority: "alta",
    description: "Tabelas cases, case_timeline e case_summaries por especialidades (Fono, Med, Psico, etc).",
  },
  {
    id: "task-006",
    title: "Pseudonimização de Alunos e Auditoria LGPD",
    status: "pronta",
    category: "governanca",
    priority: "media",
    description: "Tabelas students pseudonimizados com student_code, audit_logs com retenção de 5 anos e lgpd_requests.",
  },

  // --- EM ANDAMENTO ---
  {
    id: "task-007",
    title: "Sincronizador Automatizado de Tasks do Notion via API",
    status: "em_andamento",
    category: "governanca",
    priority: "alta",
    description: "Serviço e endpoints Fastify /api/notion/sync para sincronizar status de tarefas com a board do Notion.",
  },
  {
    id: "task-008",
    title: "Interfaces Interativas de Preenchimento das Escalas M-CHAT, FOGAP e SRQ-20",
    status: "em_andamento",
    category: "prontuario",
    priority: "alta",
    description: "Componentes visuais de formulários clínicos com pontuação e resumo automático no prontuário.",
  },

  // --- A FAZER ---
  {
    id: "task-009",
    title: "Módulo de Formação Continuada & LMS do Periscópio",
    status: "a_fazer",
    category: "lms",
    priority: "media",
    description: "Interface para consumo de cursos e aulas vinculados às tabelas courses, lessons e enrollments.",
  },
  {
    id: "task-010",
    title: "Dashboard de Gestão Municipal com Gráficos de Redes e SLA",
    status: "a_fazer",
    category: "governanca",
    priority: "media",
    description: "Visão agregada para gestores de saúde e educação acompanharem taxas de triagem e encaminhamentos.",
  },
];

/**
 * Consulta a API do Notion (se NOTION_API_KEY estiver presente) ou retorna as tarefas mapeadas do sistema.
 */
export async function fetchNotionBoardTasks(databaseId = DEFAULT_DATABASE_ID): Promise<NotionSyncResult> {
  const apiKey = process.env.NOTION_API_KEY;
  const targetDbId = process.env.NOTION_DATABASE_ID || databaseId;

  if (apiKey) {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${targetDbId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const notionTasks: SystemTask[] = (data.results || []).map((page: any) => {
          const props = page.properties || {};
          const titleProp = props.Title?.title || props.Nome?.title || props.Name?.title || [];
          const titleText = titleProp.map((t: any) => t.plain_text).join("") || "Tarefa sem título";

          const statusProp = props.Status?.status?.name || props.Status?.select?.name || "A Fazer";
          let status: "pronta" | "em_andamento" | "a_fazer" = "a_fazer";
          if (/conclu[ií]da|pronta|done/i.test(statusProp)) status = "pronta";
          else if (/em andamento|in progress|fazendo/i.test(statusProp)) status = "em_andamento";

          return {
            id: page.id,
            title: titleText,
            status,
            category: "outros",
            description: `Atualizado via API Notion em ${new Date().toLocaleDateString("pt-BR")}`,
          };
        });

        if (notionTasks.length > 0) {
          return summarizeTasks(notionTasks);
        }
      }
    } catch (error) {
      console.warn("Aviso: Falha ao conectar na API do Notion, utilizando tarefas mapeadas locais:", error);
    }
  }

  // Fallback padrão com inventário real do repositório
  return summarizeTasks(KNOWN_SYSTEM_TASKS);
}

function summarizeTasks(tasks: SystemTask[]): NotionSyncResult {
  const completed = tasks.filter((t) => t.status === "pronta");
  const inProgress = tasks.filter((t) => t.status === "em_andamento");
  const todo = tasks.filter((t) => t.status === "a_fazer");

  return {
    total: tasks.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    todoCount: todo.length,
    tasks,
    syncedAt: new Date().toISOString(),
  };
}

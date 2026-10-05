"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  X,
  Award,
  Clock,
  Video,
  FileText,
  ChevronRight,
  Check,
} from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: "video" | "text" | "quiz";
  content: string;
  completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  totalDuration: string;
  modulesCount: number;
  lessons: Lesson[];
}

const DEMO_COURSES: Course[] = [
  {
    id: "course-1",
    title: "Aplicação Prática da Ficha FOGAP & Marcos do Desenvolvimento",
    description: "Capacitação completa para professores e orientadores na observação de sinais psicotores e comportamentais na infância.",
    instructor: "Dra. Ana Cecília MD",
    totalDuration: "4h 30min",
    modulesCount: 3,
    lessons: [
      {
        id: "les-1",
        title: "Aula 1: Introdução ao Protocolo NEMT Escolar",
        duration: "15 min",
        type: "video",
        content: "Nesta aula introdutória, revisaremos os fundamentos legais e científicos da triagem precoce em ambiente escolar.",
        completed: true,
      },
      {
        id: "les-2",
        title: "Aula 2: Observação da Psicomotricidade Fina e Ampla",
        duration: "25 min",
        type: "video",
        content: "Como identificar assimetrias de tônus, déficit de empunhadura e alterações do esquema corporal no dia a dia.",
        completed: true,
      },
      {
        id: "les-3",
        title: "Aula 3: Preenchimento e Registro de Evidências LGPD",
        duration: "20 min",
        type: "text",
        content: "Orientações sobre a pseudonimização dos dados de alunos e guarda dos registros sem expor identificadores diretos.",
        completed: false,
      },
    ],
  },
  {
    id: "course-2",
    title: "Rastreamento do Espectro Autista com a Escala M-CHAT-R/F",
    description: "Treinamento em serviço para identificação de sinais precoces de TEA em crianças pequenas e condutas de acolhimento familiar.",
    instructor: "Equipe Multidisciplinar Periscópio",
    totalDuration: "3h 15min",
    modulesCount: 2,
    lessons: [
      {
        id: "les-201",
        title: "Aula 1: Fundamentos da Escala M-CHAT-R/F",
        duration: "20 min",
        type: "video",
        content: "Entenda a estrutura de 20 perguntas da M-CHAT e a lógica de pontuação e pontos de corte.",
        completed: true,
      },
      {
        id: "les-202",
        title: "Aula 2: Entrevista de Seguimento e Encaminhamento ao SUS",
        duration: "30 min",
        type: "video",
        content: "Fluxo de acoplamento com a Atenção Primária à Saúde (APS) e especialidades pediátricas.",
        completed: false,
      },
    ],
  },
  {
    id: "course-3",
    title: "Janela Terapêutica de 120 Dias & Intervenção Multiprofissional",
    description: "Guia prático para psicopedagogos, fonoaudiólogos e psicólogos na condução do prontuário compartilhado na escola.",
    instructor: "Jurema Bisogni",
    totalDuration: "5h 00min",
    modulesCount: 4,
    lessons: [
      {
        id: "les-301",
        title: "Aula 1: O Conceito de Janela Terapêutica na Escola",
        duration: "18 min",
        type: "video",
        content: "Por que aguardar 120 dias de intervenção estruturada antes de rotular ou emitir encaminhamentos externos.",
        completed: false,
      },
      {
        id: "les-302",
        title: "Aula 2: Elaboração de Pareceres Clínicos por Especialidade",
        duration: "35 min",
        type: "text",
        content: "Modelos de texto livre para Fonoaudiologia, Psicologia, Medicina e Serviço Social.",
        completed: false,
      },
    ],
  },
];

export default function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>(DEMO_COURSES);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch(`${apiUrl}/api/courses`);
        const data = await res.json();
        if (res.ok && data.courses && data.courses.length > 0) {
          // Merge API response with interactive lessons structure
          setCourses(
            data.courses.map((c: any, index: number) => ({
              ...c,
              instructor: c.instructor || "Equipe Periscópio",
              totalDuration: c.totalDuration || "4 horas",
              modulesCount: c.modulesCount || 3,
              lessons: DEMO_COURSES[index % DEMO_COURSES.length].lessons,
            }))
          );
        }
      } catch (err) {
        console.error("Erro ao carregar cursos:", err);
      }
    }
    loadCourses();
  }, [apiUrl]);

  const handleOpenCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveLesson(course.lessons[0] || null);
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    if (!selectedCourse) return;
    const updatedLessons = selectedCourse.lessons.map((l) =>
      l.id === lessonId ? { ...l, completed: !l.completed } : l
    );
    const updatedCourse = { ...selectedCourse, lessons: updatedLessons };

    setSelectedCourse(updatedCourse);
    setCourses(courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));

    if (activeLesson?.id === lessonId) {
      setActiveLesson({ ...activeLesson, completed: !activeLesson.completed });
    }
  };

  return (
    <div className="bg-white border border-[#E1E9ED] rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E1E9ED] pb-4 gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#14202B] flex items-center gap-2 font-display">
            <GraduationCap className="w-5 h-5 text-[#682880]" />
            <span>Módulo de Formação Continuada & LMS do Periscópio</span>
          </h2>
          <p className="text-xs text-[#5B6B78] mt-0.5">
            Consumo interativo de cursos e aulas vinculados às tabelas de formação pedagógica (`courses`, `lessons`, `enrollments`)
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#682880] bg-[#682880]/10 px-3 py-1 rounded-full border border-[#682880]/20 w-fit">
          <Award className="w-3.5 h-3.5" />
          <span>Certificação NEMT Ativa</span>
        </span>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {courses.map((course) => {
          const completedCount = course.lessons.filter((l) => l.completed).length;
          const totalCount = course.lessons.length;
          const progressPercent = Math.round((completedCount / totalCount) * 100);

          return (
            <div
              key={course.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-[#F6F9FB] border border-[#E1E9ED] hover:border-[#682880]/40 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#682880]/10 flex items-center justify-center text-[#682880] group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#5B6B78] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#682880]" />
                    {course.totalDuration}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#14202B] mb-1.5 leading-snug group-hover:text-[#682880] transition-colors">
                  {course.title}
                </h3>
                <p className="text-xs text-[#5B6B78] leading-relaxed mb-4 line-clamp-3">
                  {course.description}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-[#E1E9ED]">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-[#5B6B78] mb-1">
                    <span>Progresso do Aluno</span>
                    <span className="text-[#682880]">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-[#E1E9ED] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#682880] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCourse(course)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#682880] text-white text-xs font-bold hover:bg-[#52206A] shadow-sm transition-all"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>{progressPercent > 0 ? "Continuar Curso" : "Iniciar Formação"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lesson Player Modal / Drawer */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-[#E1E9ED] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E1E9ED] flex items-center justify-between bg-[#F6F9FB]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#682880] tracking-wider">
                  Curso de Formação • NEMT
                </span>
                <h3 className="text-base font-extrabold text-[#14202B] leading-tight">
                  {selectedCourse.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 rounded-lg text-[#5B6B78] hover:text-[#14202B] hover:bg-[#E1E9ED] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Split 2 Columns (Lesson Player + Syllabus Sidebar) */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3">
              {/* Left Column: Player / Lesson Content (2/3) */}
              <div className="md:col-span-2 p-6 border-b md:border-b-0 md:border-r border-[#E1E9ED] space-y-4">
                {activeLesson ? (
                  <>
                    {/* Simulated Player Screen */}
                    <div className="w-full aspect-video rounded-2xl bg-[#14202B] flex flex-col items-center justify-center p-6 text-center text-white relative shadow-inner overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="relative z-10 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-[#682880] flex items-center justify-center mx-auto text-white shadow-lg">
                          <Video className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold">{activeLesson.title}</h4>
                        <span className="text-xs text-slate-300 font-mono">Duração: {activeLesson.duration}</span>
                      </div>
                    </div>

                    {/* Lesson Description & Actions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold text-[#14202B]">{activeLesson.title}</h4>
                        <button
                          type="button"
                          onClick={() => handleToggleLessonComplete(activeLesson.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            activeLesson.completed
                              ? "bg-[#EAF6F0] text-[#1E5A41] border-[#CFE8DB]"
                              : "bg-[#F6F9FB] text-[#5B6B78] border-[#E1E9ED] hover:bg-[#F0F9FC]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{activeLesson.completed ? "Concluída" : "Marcar como Concluída"}</span>
                        </button>
                      </div>

                      <p className="text-xs text-[#5B6B78] leading-relaxed bg-[#F6F9FB] p-4 rounded-xl border border-[#E1E9ED]">
                        {activeLesson.content}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-[#5B6B78]">Selecione uma aula para iniciar.</div>
                )}
              </div>

              {/* Right Column: Syllabus & Lesson List (1/3) */}
              <div className="p-4 bg-[#FAFCFE] space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5B6B78]">
                  Conteúdo do Curso ({selectedCourse.lessons.length} Aulas)
                </h4>

                <div className="space-y-2">
                  {selectedCourse.lessons.map((les, index) => {
                    const isCurrent = activeLesson?.id === les.id;
                    return (
                      <div
                        key={les.id}
                        onClick={() => setActiveLesson(les)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isCurrent
                            ? "bg-[#682880] text-white border-[#682880] shadow-sm"
                            : "bg-white text-[#14202B] border-[#E1E9ED] hover:bg-[#F0F9FC]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              isCurrent ? "text-purple-200" : "text-[#682880]"
                            }`}
                          >
                            Aula {index + 1} • {les.type}
                          </span>
                          {les.completed && (
                            <CheckCircle2
                              className={`w-4 h-4 ${isCurrent ? "text-white" : "text-emerald-600"}`}
                            />
                          )}
                        </div>
                        <h5 className="text-xs font-bold leading-snug">{les.title}</h5>
                        <span
                          className={`text-[10px] font-mono mt-1 block ${
                            isCurrent ? "text-purple-200" : "text-[#5B6B78]"
                          }`}
                        >
                          {les.duration}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#E1E9ED] bg-[#F6F9FB] flex items-center justify-between">
              <span className="text-xs text-[#5B6B78]">
                Instrutor: <strong>{selectedCourse.instructor}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-1.5 rounded-xl bg-[#682880] text-white text-xs font-bold hover:bg-[#52206A]"
              >
                Concluir & Voltar ao Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { GraduationCap, BookOpen, PlayCircle, CheckCircle } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
}

export default function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch(`${apiUrl}/api/courses`);
        const data = await res.json();
        if (res.ok && data.courses) {
          setCourses(data.courses);
        }
      } catch (err) {
        console.error("Erro ao carregar cursos:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, [apiUrl]);

  return (
    <div className="bg-white border border-[#E1E9ED] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E1E9ED] pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#14202B] flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#682880]" />
            <span>Formação Continuada Periscópio (LMS)</span>
          </h2>
          <p className="text-xs text-[#5B6B78] mt-0.5">
            Cursos e materiais práticos para professores, psicopedagogos e gestores escolares
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-[#5B6B78] py-8 text-center">Carregando catálogo de formação...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-[#F6F9FB] border border-[#E1E9ED] hover:border-[#682880]/40 transition-all"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-[#682880]/10 flex items-center justify-center text-[#682880] mb-3">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14202B] mb-2 leading-snug">{course.title}</h3>
                <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">{course.description}</p>
              </div>

              <div className="pt-3 border-t border-[#E1E9ED] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#3D6B6B] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>3 Módulos</span>
                </span>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#682880] text-white text-xs font-semibold hover:bg-[#52206A] transition-all"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Acessar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

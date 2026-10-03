"use client";

import { motion, Variants } from "framer-motion";
import ThreeBackground from "./ThreeBackground";
import Link from "next/link";
import { ArrowRight, ShieldCheck, HeartHandshake, LogIn } from "lucide-react";

export default function Hero() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const floatingCardVariants: Variants = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <section className="relative overflow-hidden bg-[#F6F9FB] text-[#14202B] pt-12 pb-20 md:pt-16 md:pb-28 border-b border-[#E1E9ED]">
      {/* 3D Interactive Canvas Background */}
      <ThreeBackground />

      {/* Decorative ambient radial light glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-[#682880]/15 via-[#3D6B6B]/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Main Content Grid */}
        <motion.div
          className="flex flex-col items-center text-center max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#682880]/10 border border-[#682880]/25 text-[#682880] text-xs sm:text-sm font-semibold tracking-wide uppercase shadow-sm backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#682880] animate-pulse" />
              Piloto Aberto para Novos Parceiros & Redes
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#14202B] leading-[1.15] mb-6"
          >
            A escola percebe primeiro. <br className="hidden sm:inline" />
            O <span className="bg-gradient-to-r from-[#682880] via-[#7B2585] to-[#3D6B6B] bg-clip-text text-transparent">Periscópio</span> mostra o caminho do cuidado.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg lg:text-xl text-[#5B6B78] max-w-3xl leading-relaxed mb-8 font-normal"
          >
            Uma plataforma completa que reúne escola, saúde e assistência social em um único fluxo integrativo.
            O professor observa, a equipe multidisciplinar avalia com segurança e a história da criança nunca se perde.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto mb-10"
          >
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="#contato"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#682880] to-[#52206A] text-white font-semibold text-base shadow-lg shadow-[#682880]/25 hover:shadow-xl hover:shadow-[#682880]/35 transition-all"
            >
              <span>Candidatar minha instituição</span>
              <ArrowRight className="w-4 h-4" />
            </motion.a>

            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="#como"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#E1E9ED] text-[#14202B] font-semibold text-base shadow-sm hover:bg-[#F0F9FC] hover:border-[#3D6B6B]/40 transition-all"
            >
              <span>Ver como funciona</span>
            </motion.a>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#3D6B6B]/10 text-[#3D6B6B] font-semibold text-base border border-[#3D6B6B]/30 hover:bg-[#3D6B6B]/20 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar no Sistema</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Target Audience Chips */}
          <motion.div variants={itemVariants} className="w-full max-w-2xl pt-2 pb-6">
            <p className="text-xs uppercase tracking-wider text-[#5B6B78] font-bold mb-3">
              Procuramos parceiros para o piloto:
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <span className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E1E9ED] text-[#14202B] text-xs sm:text-sm font-medium shadow-xs">
                🏛️ Prefeituras e Secretarias
              </span>
              <span className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E1E9ED] text-[#14202B] text-xs sm:text-sm font-medium shadow-xs">
                🏫 Escolas Públicas e Privadas
              </span>
              <span className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E1E9ED] text-[#14202B] text-xs sm:text-sm font-medium shadow-xs">
                🤝 Instituições Sem Fins Lucrativos
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Large Hero Image Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          className="relative mt-6 max-w-5xl mx-auto"
        >
          {/* Main Large Image Card */}
          <div className="group relative rounded-3xl overflow-hidden border border-[#E1E9ED] bg-white p-3 sm:p-5 shadow-2xl shadow-[#14202B]/10 hover:shadow-3xl transition-all duration-500">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F0F9FC] to-[#F6F9FB]">
              {/* Image itself - High Resolution & Large Scale */}
              <img
                src="/hero-escola.png"
                alt="Saúde Mental na Escola — Plataforma Periscópio"
                className="w-full h-auto object-cover rounded-2xl transform transition-transform duration-700 group-hover:scale-[1.01]"
                loading="eager"
              />

              {/* Glassmorphic Gradient Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#14202B]/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {/* Floating Glassmorphic Feature Badge Left */}
            <motion.div
              variants={floatingCardVariants}
              animate="animate"
              className="absolute -top-4 -left-4 sm:top-6 sm:-left-6 bg-white/90 backdrop-blur-md border border-[#E1E9ED] p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center gap-3 hidden sm:flex"
            >
              <div className="w-10 h-10 rounded-xl bg-[#682880]/15 flex items-center justify-center text-[#682880]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#14202B]">LGPD & Prontuário Seguro</p>
                <p className="text-[11px] text-[#5B6B78]">Dados Pseudonimizados</p>
              </div>
            </motion.div>

            {/* Floating Glassmorphic Feature Badge Right */}
            <motion.div
              variants={floatingCardVariants}
              animate="animate"
              className="absolute -bottom-4 -right-4 sm:bottom-8 sm:-right-6 bg-white/90 backdrop-blur-md border border-[#E1E9ED] p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center gap-3 hidden sm:flex"
            >
              <div className="w-10 h-10 rounded-xl bg-[#3D6B6B]/15 flex items-center justify-center text-[#3D6B6B]">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#14202B]">Rede Integrada de Cuidado</p>
                <p className="text-[11px] text-[#5B6B78]">Escola + Saúde + Assistência</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

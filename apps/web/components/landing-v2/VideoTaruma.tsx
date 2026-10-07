"use client";

import { useState } from "react";

const ID = "aVe0gyIF8X4";

export function VideoTaruma() {
  const [play, setPlay] = useState(false);
  return (
    <div className="mx-auto mt-10 aspect-video max-w-3xl overflow-hidden rounded-[2rem] border-4 border-white bg-secondary shadow-lift">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`}
          title="Vídeo sobre o Programa Periscópio em Tarumã"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label="Assistir ao vídeo sobre o Programa Periscópio em Tarumã"
          className="group relative h-full w-full"
        >
          <img
            src={`https://i.ytimg.com/vi_webp/${ID}/hqdefault.webp`}
            alt=""
            loading="lazy"
            width={480}
            height={360}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-amarelo text-grafite shadow-lg transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

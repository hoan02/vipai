"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { faqs } from "@/lib/data";

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="section" id="faq" aria-label="Frequently asked questions" style={{ paddingTop: "clamp(30px,4vw,50px)" }}>
      <div className="sec-head center">
        <h2 className="sec-title">FAQ</h2>
      </div>
      <div className="faq-list">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          const delay = ["motion-delay-0", "motion-delay-75", "motion-delay-100", "motion-delay-150", "motion-delay-200", "motion-delay-300"][Math.min(i, 5)];
          return (
            <div
              className={`faq-item ai-reveal motion-preset-slide-up motion-duration-500 ${delay}${isOpen ? " is-open" : ""}`}
              key={f.q}
            >
              <button
                className="faq-q"
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faqA${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {f.q}
                <Icon name="ic-chevron" />
              </button>
              <div className="faq-a" id={`faqA${i}`} role="region" aria-hidden={!isOpen}>
                <p>{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

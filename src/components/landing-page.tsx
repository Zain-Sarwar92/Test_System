import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Reveal } from "@/components/landing-reveal";
import { LandingNavBar } from "@/components/landing-nav-bar";

const PROOF = [
  { value: "9–12", label: "Board classes" },
  { value: "3", label: "Question types" },
  { value: "EN · UR", label: "Dual mediums" },
  { value: "PDF", label: "Print-ready export" },
] as const;

const WHY_HITS = [
  {
    n: "01",
    hook: "Syllabus wizard",
    line: "Board → Class → Subject → Chapters → Topics. Teachers follow the same path they already teach.",
  },
  {
    n: "02",
    hook: "Auto or manual generation",
    line: "Balanced mode covers topics evenly. Manual mode lets you pick, swap, reorder, and drop questions.",
  },
  {
    n: "03",
    hook: "Global question bank",
    line: "MCQ, short, and long questions in English and Urdu — one bank for the whole institute.",
  },
  {
    n: "04",
    hook: "Schedules and branded PDF",
    line: "Admins assign exams and dates. Teachers export a paper with school logo, marks, time, and instructions.",
  },
] as const;

const STEP_CARDS = [
  {
    n: "01",
    title: "Set up the institute",
    body: "Admins add teachers, subjects, and exam dates.",
  },
  {
    n: "02",
    title: "Build the test",
    body: "Teachers use the syllabus wizard — auto or manual.",
  },
  {
    n: "03",
    title: "Export and print",
    body: "Review once, then download a clean branded PDF.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <LandingNavBar />

      <main id="top">
        <section className="landing-hero" aria-labelledby="landing-headline">
          <div className="landing-hero-bg" aria-hidden />
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-brand">Green Book</p>
              <h1 id="landing-headline" className="landing-headline">
                Board-pattern tests. Ready in minutes.
              </h1>
              <p className="landing-lede">
                For Pakistani schools and academies — syllabus wizard, auto or
                manual questions, and print-ready branded PDFs.
              </p>
              <div className="landing-cta-row">
                <Link
                  href="/login"
                  className="landing-btn landing-btn-solid landing-btn-lg"
                >
                  Institute login
                </Link>
                <a
                  href="#product"
                  className="landing-btn landing-btn-outline landing-btn-lg"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="landing-hero-visual" aria-hidden>
              <div className="landing-stage">
                <div className="landing-wizard-card">
                  <div className="landing-wizard-top">
                    <ClipboardList className="h-4 w-4" />
                    <span>Test wizard</span>
                  </div>
                  <ol className="landing-wizard-steps">
                    <li className="is-done">Board · Punjab</li>
                    <li className="is-done">Class · 10th</li>
                    <li className="is-active">Subject · Biology</li>
                    <li>Chapters · Topics</li>
                  </ol>
                  <div className="landing-wizard-bar">
                    <span />
                  </div>
                </div>

                <div className="landing-paper-card">
                  <div className="landing-paper-head">
                    <span className="landing-paper-seal">GB</span>
                    <div>
                      <p className="landing-paper-org">Sunrise Academy</p>
                      <p className="landing-paper-meta">
                        Biology · Mid Term · 40 marks
                      </p>
                    </div>
                  </div>
                  <div className="landing-paper-rule" />
                  <ul className="landing-paper-qs">
                    <li>
                      <b>Q1.</b> Define photosynthesis.
                    </li>
                    <li>
                      <b>Q2.</b> Powerhouse of the cell is?
                    </li>
                    <li>
                      <b>Q3.</b> Mitosis vs meiosis.
                    </li>
                  </ul>
                  <div className="landing-paper-tags">
                    <span>Auto</span>
                    <span>Balanced</span>
                    <span>Editable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-proof" aria-label="Product highlights">
            <div className="landing-proof-inner">
              {PROOF.map((item, i) => (
                <Reveal
                  key={item.label}
                  from={i % 2 === 0 ? "up" : "scale"}
                  delay={60 + i * 70}
                  className="landing-proof-item"
                >
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="landing-section theme-white">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Product</p>
              <h2 className="landing-section-title">
                What Green Book actually does.
              </h2>
              <p className="landing-section-lede">
                A workspace for Pakistani schools: generate the paper, edit it,
                then print it — from one question bank.
              </p>
            </Reveal>

            <ol className="landing-hit-list">
              {WHY_HITS.map((hit, i) => (
                <Reveal
                  key={hit.n}
                  from="left"
                  delay={70 + i * 100}
                  className="landing-hit"
                >
                  <span className="landing-hit-n" aria-hidden>
                    {hit.n}
                  </span>
                  <div>
                    <p className="landing-hit-hook">{hit.hook}</p>
                    <p className="landing-hit-line">{hit.line}</p>
                  </div>
                </Reveal>
              ))}
            </ol>

            <Reveal from="up" className="landing-section-head landing-section-head--roles" id="how">
              <p className="landing-kicker">How it works</p>
              <h2 className="landing-section-title">Three steps to print day.</h2>
            </Reveal>

            <div className="landing-step-grid landing-step-grid--anim">
              {STEP_CARDS.map((step, i) => (
                <Reveal
                  key={step.n}
                  from="up"
                  delay={i * 140}
                  className="landing-step-card"
                >
                  <span className="landing-step-num" aria-hidden>
                    {step.n}
                  </span>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p>{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <p className="landing-footer-brand">Green Book</p>
            <p className="landing-footer-tag">
              Test generation for schools, academies, and colleges.
            </p>
          </div>
          <div className="landing-footer-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <Link href="/login">Login</Link>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} Green Book. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

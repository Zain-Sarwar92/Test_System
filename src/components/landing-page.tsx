import Link from "next/link";
import {
  BookOpenCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  FileDown,
  Layers3,
  PencilLine,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { Reveal } from "@/components/landing-reveal";
import { LandingNavBar } from "@/components/landing-nav-bar";

const PROOF = [
  { value: "9–12", label: "Board classes" },
  { value: "3", label: "Question types" },
  { value: "EN · UR", label: "Dual mediums" },
  { value: "PDF", label: "Print-ready export" },
] as const;

const FEATURE_CARDS = [
  {
    icon: Wand2,
    title: "Auto-Balanced Generation",
    body: "Generate balanced papers with smart topic coverage—without manually searching through the question bank.",
  },
  {
    icon: PencilLine,
    title: "Manual Pick & Edit",
    body: "Select questions yourself, then replace, reorder, edit, or remove them before generating the final paper.",
  },
  {
    icon: Layers3,
    title: "Board → Topic Wizard",
    body: "Follow a simple teacher-friendly flow: Board → Class → Subject → Chapters → Generate.",
  },
  {
    icon: BookOpenCheck,
    title: "Global Question Bank",
    body: "Manage MCQs, short, and long questions in one centralized question bank, securely organized for each institute.",
  },
  {
    icon: CalendarClock,
    title: "Exam Scheduling",
    body: "Admins can assign subjects and exam dates, while teachers build papers from their assigned exams.",
  },
  {
    icon: FileDown,
    title: "Branded PDF Papers",
    body: "Generate print-ready papers with your institute logo, header fields, marks, time, and instructions.",
  },
] as const;

const MODE_CARDS = [
  {
    icon: Sparkles,
    title: "Auto Mode",
    badge: "Fast & Balanced",
    points: [
      "Balanced topic distribution",
      "MCQ, short & long question mix",
      "Generate instantly, then tweak",
    ],
  },
  {
    icon: Shuffle,
    title: "Manual Mode",
    badge: "Full Control",
    points: [
      "Pick every question yourself",
      "See your paper in real time",
      "Save unlimited drafts",
    ],
  },
] as const;

const COVERAGE_CARDS = [
  {
    title: "Punjab Board (PTB)",
    detail: "Grades 9–12 with chapter and topic-based paper generation.",
    tone: "teal",
  },
  {
    title: "Federal Board",
    detail: "Board-pattern structure with expanding subject coverage.",
    tone: "navy",
  },
  {
    title: "Primary Publishers",
    detail: "AFAQ, Oxford, and Gohar pathways for early grades.",
    tone: "gold",
  },
] as const;

const TYPE_CARDS = [
  {
    code: "MCQs",
    label: "MCQs",
    hint: "4-option objective questions with answer keys.",
  },
  {
    code: "Short",
    label: "Short Questions",
    hint: "Clear, board-style short-answer questions.",
  },
  {
    code: "Long",
    label: "Long Questions",
    hint: "Essay and long-answer questions with proper marks distribution.",
  },
] as const;

const STEP_CARDS = [
  {
    n: "01",
    title: "Set Up Your Institute",
    body: "Admins add teachers, sections, subjects, and exam schedules.",
  },
  {
    n: "02",
    title: "Create the Paper",
    body: "Teachers follow the syllabus wizard, then generate automatically or pick questions manually.",
  },
  {
    n: "03",
    title: "Export & Print",
    body: "Review the paper, make final edits, and export a clean, branded PDF—ready to print.",
  },
] as const;

const ROLE_CARDS = [
  {
    icon: ShieldCheck,
    role: "Super Admin",
    body: "Manage institutes, plans, hierarchy, and the global question bank.",
  },
  {
    icon: Building2,
    role: "Org Admin",
    body: "Manage teachers, sections, exam schedules, and institute branding.",
  },
  {
    icon: Users,
    role: "Teacher",
    body: "Generate, edit, save, and print papers from assigned exams.",
  },
] as const;

const FEATURE_FROM = ["left", "up", "right", "left", "up", "right"] as const;
const COVER_FROM = ["left", "scale", "right"] as const;
const TYPE_FROM = ["left", "up", "down", "right"] as const;
const STEP_FROM = ["left", "up", "right"] as const;
const ROLE_FROM = ["left", "scale", "right"] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <LandingNavBar />

      <main id="top">
        <section className="landing-hero" aria-labelledby="landing-brand">
          <div className="landing-hero-bg" aria-hidden />
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p id="landing-brand" className="landing-brand">
                Test Hub
              </p>
              <h1 className="landing-headline">
                Board-Pattern Papers. Ready in Minutes, Not Hours.
              </h1>
              <p className="landing-lede">
                Create professional test papers for Pakistani schools and
                academies—with smart wizard selection, manual controls, and
                print-ready branded PDFs.
              </p>
              <div className="landing-cta-row">
                <Link
                  href="/login"
                  className="landing-btn landing-btn-solid landing-btn-lg"
                >
                  Open institute login
                </Link>
                <a
                  href="#features"
                  className="landing-btn landing-btn-outline landing-btn-lg"
                >
                  Explore features
                </a>
              </div>
            </div>

            <div className="landing-hero-visual" aria-hidden>
              <div className="landing-stage">
                <div className="landing-wizard-card">
                  <div className="landing-wizard-top">
                    <ClipboardList className="h-4 w-4" />
                    <span>Paper wizard</span>
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
                    <span className="landing-paper-seal">TH</span>
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
        </section>

        <section className="landing-proof" aria-label="Product highlights">
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
        </section>

        <section id="features" className="landing-section theme-white">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Why Test Hub</p>
              <h2 className="landing-section-title">
                Everything you need to create better papers — in one workspace.
              </h2>
              <p className="landing-section-lede">
                From board selection to branded PDF, Test Hub gives admins and
                teachers everything they need to create balanced, professional
                papers faster.
              </p>
            </Reveal>

            <div className="landing-card-grid">
              {FEATURE_CARDS.map((card, i) => {
                const Icon = card.icon;
                return (
                  <Reveal
                    key={card.title}
                    from={FEATURE_FROM[i]}
                    delay={i * 90}
                    className="landing-card"
                  >
                    <span className="landing-card-icon" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="modes" className="landing-section theme-green">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Generation Modes</p>
              <h2 className="landing-section-title">
                Generate automatically when you&apos;re in a hurry. Go manual
                when you want full control.
              </h2>
            </Reveal>

            <div className="landing-mode-grid">
              {MODE_CARDS.map((mode, i) => {
                const Icon = mode.icon;
                return (
                  <Reveal
                    key={mode.title}
                    from={i === 0 ? "left" : "right"}
                    delay={i * 120}
                    className="landing-mode-card"
                  >
                    <div className="landing-mode-top">
                      <span className="landing-card-icon" aria-hidden>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="landing-badge">{mode.badge}</span>
                    </div>
                    <h3>{mode.title}</h3>
                    <ul>
                      {mode.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="coverage" className="landing-section theme-white">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Coverage</p>
              <h2 className="landing-section-title">
                Built for the boards, subjects, and question formats Pakistani
                schools actually use.
              </h2>
            </Reveal>

            <div className="landing-coverage-grid">
              {COVERAGE_CARDS.map((card, i) => (
                <Reveal
                  key={card.title}
                  from={COVER_FROM[i]}
                  delay={i * 110}
                  className={`landing-cover-card tone-${card.tone}`}
                >
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="types" className="landing-section theme-green">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head landing-section-head--compact">
              <p className="landing-kicker">Question formats</p>
            </Reveal>

            <div className="landing-type-grid landing-type-grid--tight">
              {TYPE_CARDS.map((card, i) => (
                <Reveal
                  key={card.code}
                  from={TYPE_FROM[i]}
                  delay={i * 90}
                  className="landing-type-card"
                >
                  {card.code !== card.label ? (
                    <span className="landing-type-code">{card.code}</span>
                  ) : null}
                  <strong>{card.label}</strong>
                  <span>{card.hint}</span>
                </Reveal>
              ))}
              <Reveal
                from="right"
                delay={280}
                className="landing-type-card landing-type-card-wide"
              >
                <span className="landing-type-code">Medium</span>
                <strong>English • Urdu • Dual Medium</strong>
                <span>
                  Switch the paper medium without rebuilding your question bank.
                </span>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="how" className="landing-section theme-white">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">How It Works</p>
              <h2 className="landing-section-title">
                From exam schedule to print-ready paper in three simple steps.
              </h2>
            </Reveal>

            <div className="landing-step-grid">
              {STEP_CARDS.map((step, i) => (
                <Reveal
                  key={step.n}
                  from={STEP_FROM[i]}
                  delay={i * 120}
                  className="landing-step-card"
                >
                  <h3 className="landing-step-title">
                    {step.n} — {step.title}
                  </h3>
                  <p>{step.body}</p>
                </Reveal>
              ))}
            </div>

            <Reveal from="up" className="landing-section-head landing-section-head--roles">
              <p className="landing-kicker">Built for Every Role</p>
              <h2 className="landing-section-title">
                Super Admin, Org Admin, and Teacher — each with the right tools.
              </h2>
            </Reveal>

            <div className="landing-role-grid">
              {ROLE_CARDS.map((card, i) => {
                const Icon = card.icon;
                return (
                  <Reveal
                    key={card.role}
                    from={ROLE_FROM[i]}
                    delay={i * 110}
                    className="landing-role-card"
                  >
                    <span className="landing-card-icon" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3>{card.role}</h3>
                    <p>{card.body}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="start" className="landing-cta-band">
          <Reveal from="up" className="landing-cta-band-inner">
            <p className="landing-brand landing-brand-on-dark">Test Hub</p>
            <h2 className="landing-cta-title">
              Ready for your next mid-term paper?
            </h2>
            <p className="landing-cta-copy">
              Sign in with your institute account. Admins manage teachers and
              schedules; teachers generate unlimited papers from the shared bank.
            </p>
            <div className="landing-cta-row">
              <Link
                href="/login"
                className="landing-btn landing-btn-solid landing-btn-lg"
              >
                Login to Test Hub
              </Link>
              <a
                href="#features"
                className="landing-btn landing-btn-outline-light landing-btn-lg"
              >
                Review features
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <p className="landing-footer-brand">Test Hub</p>
            <p className="landing-footer-tag">
              Multi-tenant test generation for schools, academies, and colleges.
            </p>
          </div>
          <div className="landing-footer-links">
            <Link href="/login">Teacher login</Link>
            <Link href="/login">Institute login</Link>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} Test Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

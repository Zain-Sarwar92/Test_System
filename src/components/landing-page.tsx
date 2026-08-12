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
    title: "Auto balanced generation",
    body: "One question per topic each round — fair coverage without hunting the bank by hand.",
  },
  {
    icon: PencilLine,
    title: "Manual pick & edit",
    body: "Hand-select every stem, then replace, reorder, or remove before you print.",
  },
  {
    icon: Layers3,
    title: "Board → topic wizard",
    body: "Same flow teachers expect: board, class, subject, chapters, then generate.",
  },
  {
    icon: BookOpenCheck,
    title: "Global question bank",
    body: "MCQ, short, and long questions curated once — available to every org securely.",
  },
  {
    icon: CalendarClock,
    title: "Exam schedules",
    body: "Org admins lock subjects and dates; teachers build from assigned work.",
  },
  {
    icon: FileDown,
    title: "Branded PDF papers",
    body: "Institute logo, header fields, marks, time, and instructions on every sheet.",
  },
] as const;

const MODE_CARDS = [
  {
    icon: Sparkles,
    title: "Auto mode",
    badge: "Default",
    points: [
      "Balanced topic distribution",
      "MCQ + short + long mix",
      "Ready to tweak after generate",
    ],
  },
  {
    icon: Shuffle,
    title: "Manual mode",
    badge: "Full control",
    points: [
      "Pick each question yourself",
      "Live paper preview",
      "Save unlimited drafts",
    ],
  },
] as const;

const COVERAGE_CARDS = [
  {
    title: "Punjab / PTB",
    detail: "9th – 12th core subjects with chapter & topic filters.",
    tone: "teal",
  },
  {
    title: "Federal track",
    detail: "Pattern-ready structure — content rolling online.",
    tone: "navy",
  },
  {
    title: "Primary publishers",
    detail: "AFAQ, Oxford, and Gohar pathways for early grades.",
    tone: "gold",
  },
] as const;

const TYPE_CARDS = [
  { code: "MCQ", label: "Objective", hint: "4 options + key" },
  { code: "Short", label: "Short answer", hint: "Quick constructs" },
  { code: "Long", label: "Essay / long", hint: "Board-style depth" },
] as const;

const STEP_CARDS = [
  {
    n: "01",
    title: "Configure the institute",
    body: "Org admin adds teachers, sections, and named exam schedules.",
  },
  {
    n: "02",
    title: "Generate the paper",
    body: "Teacher walks the syllabus wizard, then auto-builds or hand-picks.",
  },
  {
    n: "03",
    title: "Export & deliver",
    body: "Print a clean branded PDF — schedules keep papers even if roles change.",
  },
] as const;

const ROLE_CARDS = [
  {
    icon: ShieldCheck,
    role: "Super Admin",
    body: "Orgs, plans, hierarchy, and the global question bank.",
  },
  {
    icon: Building2,
    role: "Org Admin",
    body: "Teachers, sections, schedules, and institute branding.",
  },
  {
    icon: Users,
    role: "Teacher",
    body: "Generate, edit, save, and print papers from assignments.",
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
                Generate board-pattern papers in minutes — not evenings.
              </h1>
              <p className="landing-lede">
                The institute-grade paper generator for Pakistani schools and
                academies: wizard selection, auto or manual mode, teacher
                portals, and print-ready branded PDFs.
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

        <section id="features" className="landing-section theme-paper">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Why Test Hub</p>
              <h2 className="landing-section-title">
                Everything a modern paper generator needs — in one workspace.
              </h2>
              <p className="landing-section-lede">
                From board selection to branded PDF — one platform where admins
                schedule exams, teachers generate balanced papers, and every
                institute runs in its own secure workspace.
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

        <section id="modes" className="landing-section theme-dark">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Generation modes</p>
              <h2 className="landing-section-title">
                Auto when you are rushed. Manual when you want control.
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

        <section id="coverage" className="landing-section theme-light">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">Coverage</p>
              <h2 className="landing-section-title">
                Boards, mediums, and question types that match real exams.
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

            <div className="landing-type-grid">
              {TYPE_CARDS.map((card, i) => (
                <Reveal
                  key={card.code}
                  from={TYPE_FROM[i]}
                  delay={i * 90}
                  className="landing-type-card"
                >
                  <span className="landing-type-code">{card.code}</span>
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
                <strong>English · Urdu · Dual</strong>
                <span>Switch medium per paper without rebuilding the bank.</span>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="how" className="landing-section theme-mint">
          <div className="landing-section-inner">
            <Reveal from="up" className="landing-section-head">
              <p className="landing-kicker">How it works</p>
              <h2 className="landing-section-title">
                From schedule to printed paper in three clear steps.
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
                  <span className="landing-step-n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Reveal>
              ))}
            </div>

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

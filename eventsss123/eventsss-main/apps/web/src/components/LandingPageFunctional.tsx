/**
 * Public ESS landing page for web and mobile.
 */
import React, { useState, useEffect } from "react";
import { SELF_REGISTER_ROLES, roleLabel } from "../lib/roleLabels";

interface LandingPageProps {
  onOpenAuth: (role?: string, mode?: "signin" | "signup" | "forgot") => void;
  onStartBuilder: () => void;
  onDownloadAndroid?: () => void;
}

const CSS = `
.esg-brand-image{display:block;width:38px;height:38px;flex:0 0 38px;object-fit:contain;border-radius:10px;filter:drop-shadow(0 3px 10px rgba(255,106,0,.12))}
.esg-brand-copy{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
.esg-brand-copy .esg-brand{font-size:16px;letter-spacing:.08em}
.esg-brand-image--footer{width:36px;height:36px;flex-basis:36px}
@media(max-width:480px){.esg-brand-image{width:34px;height:34px;flex-basis:34px}.esg-brand-copy .esg-brand{font-size:14px}.esg-sub{font-size:9px}}

.esg{--card:var(--surface);--ink:var(--text);--mute:var(--muted);--line:var(--border);--cyan:var(--primary);--blue:var(--primary-2);--indigo:var(--primary-2);--emerald:var(--success);--amber:var(--warning);--rose:var(--danger);--purple:var(--escrow);background:var(--bg);color:var(--ink);font:16px/1.55 var(--font);min-height:100vh}
.esg *,.esg *::before,.esg *::after{box-sizing:border-box}
.esg h1,.esg h2,.esg h3{margin:0;font-weight:800;letter-spacing:-.03em;line-height:1.12}
.esg button{font:inherit;color:inherit;cursor:pointer}
.esg a{color:inherit}
.esg :focus-visible{outline:3px solid var(--cyan);outline-offset:2px}
.esg-w{max-width:1120px;margin:0 auto;padding:0 20px}
.esg-nav{position:sticky;top:var(--safe-top,0px);z-index:40;background:rgba(18,26,46,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.esg-nav .esg-w{display:flex;align-items:center;gap:16px;height:64px}
.esg-logo{display:flex;align-items:center;gap:10px;background:none;border:0;padding:0;cursor:pointer}
.esg-mark{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--primary-2),var(--primary));display:grid;place-items:center;box-shadow:0 0 24px rgba(45,212,191,.25)}
.esg-mark svg{width:22px;height:22px}
.esg-brand{font-weight:900;font-size:17px;background:linear-gradient(90deg,var(--text),var(--primary),var(--primary-2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.esg-sub{font-size:10px;color:var(--mute);font-weight:600;margin-top:1px}
.esg-links{display:flex;gap:6px;flex:1;margin-left:12px;flex-wrap:wrap}
.esg-links button{background:none;border:0;color:var(--mute);font-weight:600;font-size:13px;padding:6px 10px;border-radius:8px}
.esg-links button:hover{color:var(--cyan);background:rgba(255,106,0,.1)}
.esg-btn{padding:10px 18px;border-radius:999px;border:1.5px solid transparent;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:8px;transition:transform .15s,box-shadow .15s}
.esg-btn:hover{transform:translateY(-1px)}
.esg-btn.p{background:linear-gradient(135deg,var(--primary-2),var(--primary));color:#0b1020;box-shadow:0 8px 28px rgba(45,212,191,.2)}
.esg-btn.p:hover{box-shadow:0 10px 32px rgba(45,212,191,.3)}
.esg-btn.g{background:var(--surface-2);border-color:var(--border);color:var(--text)}
.esg-btn.g:hover{border-color:var(--cyan)}
.esg-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.esg-burger{display:grid;margin-left:auto;width:44px;height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);place-items:center;color:var(--ink)}
.esg-drawer{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.68);padding:var(--screen-pad-top) max(16px,var(--safe-right)) var(--screen-pad-bottom) max(16px,var(--safe-left))}
.esg-drawer nav{position:absolute;right:var(--safe-right,0px);top:var(--safe-top,0px);bottom:var(--safe-bottom,0px);width:min(88vw,360px);background:var(--card);border-left:1px solid var(--line);padding:20px;display:flex;flex-direction:column;gap:4px;overflow-y:auto}
.esg-drawer a,.esg-drawer button.link{padding:14px 12px;border-radius:12px;background:none;border:0;text-align:left;font-size:16px;font-weight:600;color:var(--ink)}
.esg-drawer a:hover,.esg-drawer button.link:hover{background:rgba(34,211,238,.1);color:var(--cyan)}
.esg-hero{padding:56px 0 64px;position:relative;overflow:hidden}
.esg-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at top,rgba(255,106,0,.16),transparent 55%),radial-gradient(ellipse at bottom right,rgba(255,176,32,.12),transparent 50%);pointer-events:none}
.esg-hero .esg-w{position:relative;z-index:1;text-align:center;max-width:820px}
.esg-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,106,0,.12);border:1px solid rgba(255,106,0,.4);color:#c2410c;font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;margin-bottom:20px}
.esg-hero h1{font-size:clamp(2.2rem,5.5vw,3.6rem);margin-bottom:16px}
.esg-hero h1 em{font-style:normal;background:linear-gradient(90deg,#ff8500,#ff6a00,#ff4d00);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.esg-hero p.lead{color:var(--mute);font-size:18px;max-width:560px;margin:0 auto 28px}
.esg-ctas{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:28px}
.esg-trust{display:flex;flex-wrap:wrap;gap:16px 24px;justify-content:center;color:var(--mute);font-size:13px;font-weight:600}
.esg-trust span{display:inline-flex;align-items:center;gap:6px}
.esg-trust i{color:var(--emerald);font-style:normal}
.esg-stats{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.75);padding:28px 0}
.esg-stats .esg-w{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center}
.esg-stats strong{display:block;font-size:1.75rem;font-weight:900;color:var(--cyan)}
.esg-stats strong.em{color:var(--emerald)}.esg-stats strong.am{color:var(--amber)}.esg-stats strong.ro{color:var(--rose)}.esg-stats strong.pu{color:var(--purple)}.esg-stats strong.bl{color:#60a5fa}
.esg-stats small{color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.esg-sec{padding:64px 0}
.esg-sec h2{font-size:clamp(1.6rem,3.5vw,2.4rem);margin-bottom:10px;text-align:center}
.esg-sec .eye{text-align:center;font-size:11px;font-weight:800;color:var(--cyan);text-transform:uppercase;letter-spacing:.14em;margin-bottom:8px}
.esg-sec .sub{text-align:center;color:var(--mute);max-width:640px;margin:0 auto 36px;font-size:16px}
.esg-grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.esg-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.esg-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.esg-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;transition:border-color .2s,box-shadow .2s}
.esg-card:hover{border-color:#ffb020;box-shadow:0 12px 40px rgba(255,106,0,.12)}
.esg-card h3{font-size:18px;margin:10px 0 6px}
.esg-card p{margin:0;color:var(--mute);font-size:14px}
.esg-ico{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:22px;border:1px solid}
.esg-ico.cyan{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ico.em{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ico.am{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ico.ro{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ico.pu{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ico.bl{background:#fff0e6;border-color:#ffc090;color:#ff4d00}
.esg-ul{list-style:none;margin:14px 0 0;padding:0}
.esg-ul li{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#5c4a3d;margin-bottom:6px}
.esg-ul li::before{content:"✓";color:var(--emerald);font-weight:800;flex-shrink:0}
.esg-metric{display:inline-block;margin-top:14px;padding:8px 12px;border-radius:12px;background:#fff0e6;border:1px solid #ffc090;font-size:12px}
.esg-metric b{display:block;font-size:18px;color:var(--cyan)}
.esg-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.esg-step{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}
.esg-step .num{font-size:28px;font-weight:900;color:rgba(255,106,0,.35)}
.esg-step h3{font-size:16px;margin:8px 0 6px}
.esg-chip{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:#fff0e6;color:#c2410c;border:1px solid #ffc090;margin:2px 4px 2px 0}
.esg-band{background:linear-gradient(135deg,#fff,#fff0e6);border:1px solid rgba(255,106,0,.35);border-radius:24px;padding:28px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;margin-top:28px}
.esg-band h3{font-size:22px;margin-bottom:6px}
.esg-phone{width:260px;height:520px;border-radius:36px;background:#0f172a;border:4px solid rgba(255,106,0,.45);box-shadow:0 0 48px rgba(255,106,0,.18);padding:36px 16px 16px;margin:0 auto;position:relative}
.esg-phone::before{content:"";position:absolute;top:10px;left:50%;transform:translateX(-50%);width:72px;height:14px;border-radius:999px;background:#1a120b}
.esg-phone .p-card{background:rgba(255,106,0,.1);border:1px solid rgba(255,106,0,.35);border-radius:14px;padding:12px;margin-bottom:10px}
.esg-phone .p-card b{color:var(--emerald);font-size:22px}
.esg-phone .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.esg-phone .p-grid div{background:#fff7f0;border:1px solid #f0dcc8;border-radius:10px;padding:10px;text-align:center;font-size:11px;font-weight:700;color:#c2410c}
.esg-price{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.esg-price .esg-card{display:flex;flex-direction:column}
.esg-price .amt{font-size:28px;font-weight:900;color:var(--cyan);margin:8px 0}
.esg-price .pop{position:relative;border-color:rgba(52,211,153,.55);box-shadow:0 0 24px rgba(52,211,153,.15)}
.esg-price .tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#ffb020,#ff6a00);color:#fff;font-size:10px;font-weight:900;padding:4px 10px;border-radius:999px;text-transform:uppercase}
.esg-table{width:100%;border-collapse:collapse;font-size:14px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.esg-table th,.esg-table td{padding:12px 14px;text-align:left;border-bottom:1px solid var(--line)}
.esg-table th{background:#1a120b;color:var(--mute);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.esg-table th.hi{color:var(--cyan)}
.esg-table tr:nth-child(even) td{background:rgba(15,23,42,.5)}
.esg-yes{color:var(--emerald);font-weight:700}
.esg-countries{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.esg-countries span{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600}
.esg-countries span.more{border-color:rgba(34,211,238,.4);color:#67e8f9;background:rgba(34,211,238,.1)}
.esg-quote{display:flex;flex-direction:column;height:100%}
.esg-quote .stars{color:var(--amber);letter-spacing:2px;margin-bottom:10px}
.esg-quote blockquote{flex:1;margin:0;font-size:14px;color:#e2e8f0}
.esg-quote footer{margin-top:14px;font-size:13px}
.esg-quote footer strong{display:block;color:#fff}
.esg-faq details{border:1px solid var(--line);border-radius:14px;background:var(--card);margin-bottom:10px;overflow:hidden}
.esg-faq summary{padding:16px 18px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
.esg-faq summary::-webkit-details-marker{display:none}
.esg-faq summary::after{content:"+";color:var(--cyan);font-size:20px;font-weight:400}
.esg-faq details[open] summary::after{content:"−"}
.esg-faq p{margin:0;padding:0 18px 16px;color:var(--mute);font-size:14px;border-top:1px solid var(--line);padding-top:12px}
.esg-cta{text-align:center;padding:72px 0;border-top:1px solid var(--line);position:relative}
.esg-cta::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(34,211,238,.12),transparent 60%);pointer-events:none}
.esg-cta .esg-w{position:relative;z-index:1}
.esg-ft{border-top:1px solid var(--line);padding:40px 0 28px;background:#1a120b}
.esg-ft-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:28px;margin-bottom:28px}
.esg-ft h4{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--cyan);margin:0 0 12px}
.esg-ft ul{list-style:none;margin:0;padding:0}
.esg-ft li{margin-bottom:8px}
.esg-ft button.link,.esg-ft a{background:none;border:0;padding:0;color:var(--mute);font-size:13px;font-weight:500}
.esg-ft button.link:hover,.esg-ft a:hover{color:var(--cyan)}
.esg-ft-bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--mute)}
.esg-float{position:fixed;bottom:20px;right:20px;z-index:30;background:rgba(15,23,42,.95);border:1px solid rgba(255,106,0,.45);border-radius:16px;padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(255,106,0,.18)}
.esg-float .dot{width:8px;height:8px;border-radius:50%;background:var(--emerald);animation:esgPulse 1.5s infinite}
.esg-modal{position:fixed;inset:0;z-index:60;background:rgba(26,18,11,.55);display:grid;place-items:center;padding:16px}
.esg-dialog{width:100%;max-width:420px;max-height:92vh;overflow:auto;background:var(--card);border:1px solid rgba(255,106,0,.35);border-radius:22px;padding:24px;box-shadow:0 0 48px rgba(255,106,0,.15)}
.esg-dialog h2{font-size:22px;margin-bottom:16px}
.esg-dialog label{display:block;font-size:12px;font-weight:700;color:var(--mute);margin-bottom:12px}
.esg-dialog input{width:100%;margin-top:6px;padding:11px 12px;border-radius:12px;border:1.5px solid var(--line);background:#1a120b;color:var(--ink);font:inherit}
.esg-dialog input:focus{border-color:var(--cyan);outline:none}
.esg-err{color:var(--rose);font-size:13px;margin:0 0 10px}
.esg-roles{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.esg-roles button{padding:7px 12px;border-radius:999px;border:1.5px solid var(--line);background:#1a120b;font-size:13px;font-weight:600}
.esg-roles button.on{background:var(--cyan);color:#fff;border-color:var(--cyan)}
.esg-splash{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:radial-gradient(ellipse at center,#ffe8d6 0%,#fff7f0 70%);transition:opacity .45s ease}
.esg-splash.hide{opacity:0;pointer-events:none}
.esg-splash-inner{text-align:center;animation:esgPulse 1.4s ease-in-out infinite}
.esg-splash-mark{width:72px;height:72px;margin:0 auto 16px;border-radius:18px;background:linear-gradient(135deg,#ffb020,#ff6a00,#ff4d00);display:grid;place-items:center;box-shadow:0 0 40px rgba(34,211,238,.45)}
@keyframes esgPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.04);opacity:.92}}
.esg-stats{background:var(--surface-2)}
.esg-hero::before{background:radial-gradient(ellipse at top,rgba(45,212,191,.12),transparent 55%),radial-gradient(ellipse at bottom right,rgba(129,140,248,.1),transparent 50%)}
.esg-badge{background:rgba(45,212,191,.1);border-color:rgba(45,212,191,.28);color:var(--primary)}
.esg-hero h1 em{background:linear-gradient(90deg,var(--primary),var(--primary-2));-webkit-background-clip:text}
.esg-ico.cyan,.esg-ico.em,.esg-ico.am,.esg-ico.ro,.esg-ico.pu,.esg-ico.bl{background:rgba(45,212,191,.1);border-color:rgba(45,212,191,.25);color:var(--primary)}
.esg-ul li{color:var(--text)}
.esg-metric{background:rgba(45,212,191,.08);border-color:rgba(45,212,191,.2)}
.esg-band{background:linear-gradient(135deg,var(--surface-2),var(--surface));border-color:var(--border)}
.esg-step .num{color:var(--primary)}
.esg-chip{background:rgba(45,212,191,.1);color:var(--primary);border-color:rgba(45,212,191,.25)}
.esg-card:hover{border-color:var(--primary);box-shadow:0 12px 40px rgba(45,212,191,.08)}
.esg-links button:hover{background:rgba(45,212,191,.1)}
.esg-drawer a:hover,.esg-drawer button.link:hover{background:rgba(45,212,191,.1)}
.esg-ft{background:var(--surface)}
.esg-float{border-color:rgba(45,212,191,.3);box-shadow:0 8px 32px rgba(45,212,191,.1)}
.esg-phone{background:var(--surface-2);border-color:var(--border)}
.esg-phone::before{background:var(--border)}
.esg-phone .p-card{background:var(--surface);border-color:var(--border)}
.esg-phone .p-grid div{background:var(--surface-2);border-color:var(--border);color:var(--text)}
@media(max-width:960px){
  .esg-links,.esg-nav .esg-btn.p{display:none}
  .esg-burger{display:grid}
  .esg-grid2,.esg-grid3,.esg-steps,.esg-price,.esg-ft-grid{grid-template-columns:1fr 1fr}
  .esg-grid4{grid-template-columns:1fr 1fr}
  .esg-stats .esg-w{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:640px){
  .esg-grid2,.esg-grid3,.esg-grid4,.esg-steps,.esg-price,.esg-ft-grid,.esg-stats .esg-w{grid-template-columns:1fr}
  .esg-float{display:none}
  .esg-w{padding:0 16px}
  .esg-band{flex-direction:column;align-items:stretch}
}
@media(prefers-reduced-motion:reduce){
  .esg *,.esg *::before{animation:none!important;transition:none!important}
}
`;

const STATS = [
  { v: "Plan", l: "Before creating an account", c: "" },
  { v: "One", l: "Workspace for event details", c: "em" },
  { v: "Compare", l: "Available service listings", c: "am" },
  { v: "Track", l: "Tasks and readiness", c: "ro" },
  { v: "Review", l: "Booking and payment totals", c: "pu" },
  { v: "Share", l: "Updates with your team", c: "bl" },
];

const FEATURES = [
  {
    ico: "🗓️",
    cls: "em",
    title: "Plan before you sign up",
    sub: "Start with the event, not a form",
    body: "Build an event brief first, then continue into an account when you are ready to save and manage it.",
    bullets: ["Event type and purpose", "Date and location", "Guest and budget estimates", "A clear next-step summary"],
    metric: "Begin with your event",
  },
  {
    ico: "🛍️",
    cls: "am",
    title: "Browse event services",
    sub: "Compare available providers",
    body: "Explore marketplace listings and compare the details available for each service before booking.",
    bullets: ["Browse by service category", "Review listing details", "Compare location and price", "See provider verification status"],
    metric: "Choose from available listings",
  },
  {
    ico: "✅",
    cls: "pu",
    title: "Keep planning visible",
    sub: "Know what still needs attention",
    body: "Use event tasks and readiness information to see what is complete and what still needs follow-up.",
    bullets: ["Track planning tasks", "Review event readiness", "Coordinate verifier checks", "Keep booking status in view"],
    metric: "A clearer path to event day",
  },
  {
    ico: "🔐",
    cls: "ro",
    title: "Understand booking payments",
    sub: "Review the total before confirming",
    body: "See booking and wallet amounts in the app, with payment status shown to the people involved.",
    bullets: ["Review checkout totals", "See available and held balances", "Follow booking payment status", "Check ledger activity"],
    metric: "Payment details in one place",
  },
  {
    ico: "👛",
    cls: "cyan",
    title: "Wallet and booking history",
    sub: "Keep a record of activity",
    body: "Review wallet balances and ledger entries alongside bookings managed in your workspace.",
    bullets: ["View currency balances", "Review wallet activity", "Follow booking updates", "Keep event records together"],
    metric: "Your activity, clearly shown",
  },
  {
    ico: "💬",
    cls: "bl",
    title: "Share feedback after a booking",
    sub: "Help improve the marketplace",
    body: "When a booking is eligible, leave a rating and comment about the service you received.",
    bullets: ["Review eligible completed bookings", "Rate the vendor", "Add a written comment", "Help future planners compare"],
    metric: "Feedback tied to real bookings",
  },
];

const STEPS = [
  { n: "01", t: "Start your event brief", d: "Answer a few planning questions before you create an account." },
  { n: "02", t: "Continue in your workspace", d: "Save event details and coordinate tasks, guests and budget information." },
  { n: "03", t: "Compare available services", d: "Review marketplace listings and booking details that fit your event." },
  { n: "04", t: "Track what happens next", d: "Follow readiness, booking status and feedback from your workspace." },
];

const USE = [
  { ico: "🏢", t: "Corporate gatherings", d: "Keep event details, tasks and budgets organized in one workspace." },
  { ico: "💍", t: "Weddings and celebrations", d: "Plan the occasion, coordinate guests and explore available services." },
  { ico: "🕊️", t: "Memorials and remembrance", d: "Organize important details with a calm, respectful planning process." },
  { ico: "🎓", t: "Workshops and learning", d: "Track the schedule, guest needs and service bookings for your event." },
];

const CATS = [
  { ico: "🛡️", t: "Event support", d: "Explore services available in the marketplace" },
  { ico: "🍽️", t: "Catering", d: "Multi-cuisine, dietary, logistics" },
  { ico: "🎵", t: "Entertainment & AV", d: "Stages, sound, lighting, acts" },
  { ico: "🚐", t: "Transport & Staging", d: "Fleet, floral, ceremonial" },
  { ico: "📷", t: "Media", d: "Photo, video, live-stream" },
  { ico: "🏛️", t: "Venues", d: "Ballrooms, outdoor, arenas" },
];

const FAQ = [
  ["Can I start planning without an account?", "Yes. Start with the event brief; create an account when you are ready to continue."],
  ["How are booking payments handled?", "The app shows booking and wallet activity. Review the payment method, total and status before confirming."],
  ["Where can I install the Android app?", "This page does not currently provide an official Android download link."],
  ["Which locations are supported?", "Available vendors, currencies and payment options depend on your location and the listings shown in the marketplace."],
  ["Who can list services?", "Service providers can create an account and submit the verification information requested by ESS."],
  ["Can I arrange any type of event?", "The planning workspace supports event details, tasks, guests, budgets and service bookings. Availability varies by event and location."],
];

const NAV = [
  ["features", "Features"],
  ["how", "How it works"],
  ["marketplace", "Marketplace"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
];

function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function LandingPage({
  onDownloadAndroid,
  onOpenAuth,
  onStartBuilder,
}: LandingPageProps) {
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const go = (id: string) => {
    setMenu(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 40);
  };

  const openAuth = (role: string, mode: "signin" | "signup" = "signup") => {
    setMenu(false);
    onOpenAuth(role, mode);
  };

  const launch = () => {
    onStartBuilder();
  };

  return (
    <div className="esg">
      <style>{CSS}</style>

      {/* Float badge */}
      <div className="esg-float" aria-hidden>
        <div className="esg-mark" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <ShieldIcon size={18} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>EPHINTA</div>
          <div style={{ fontSize: 10, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="dot" />
            Plan · Organize · Review
          </div>
        </div>
      </div>

      {/* Nav */}
      <header className="esg-nav">
        <div className="esg-w">
          <button type="button" className="esg-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src="/brand/ephinta_logo2.png" alt="" className="esg-brand-image" />
            <span className="esg-brand-copy">
              <span className="esg-brand">EPHINTA</span>
              <div className="esg-sub">Event Self Solutions</div>
            </span>
          </button>
          <nav className="esg-links" aria-label="Main">
            {NAV.map(([id, label]) => (
              <button key={id} type="button" onClick={() => go(id)}>
                {label}
              </button>
            ))}
          </nav>
          <button type="button" className="esg-btn p" onClick={launch}>
            Launch Portal →
          </button>
          <button type="button" className="esg-burger" aria-label="Menu" onClick={() => setMenu(true)}>
            ☰
          </button>
        </div>
      </header>

      {menu && (
        <div className="esg-drawer" onClick={() => setMenu(false)}>
          <nav onClick={(e) => e.stopPropagation()} aria-label="Mobile">
            <button type="button" className="link" style={{ alignSelf: "flex-end", fontSize: 28 }} onClick={() => setMenu(false)} aria-label="Close">
              ×
            </button>
            {NAV.map(([id, label]) => (
              <button key={id} type="button" className="link" onClick={() => go(id)}>
                {label}
              </button>
            ))}
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <button
                type="button"
                className="esg-btn g"
                onClick={() => openAuth("CLIENT", "signin")}
              >
                Sign in
              </button>
              <strong>Sign up for another role</strong>
              {SELF_REGISTER_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className="esg-btn g"
                  onClick={() => openAuth(role)}
                >
                  {roleLabel(role)}
                </button>
              ))}
              <button type="button" className="esg-btn p" onClick={launch}>
                Start planning an event
              </button>
              {onDownloadAndroid && (
                <button type="button" className="esg-btn g" onClick={onDownloadAndroid}>
                  Get Android App
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Hero */}
      <section className="esg-hero">
        <div className="esg-w">
          <div className="esg-badge">Plan first. Create an account when you are ready.</div>
          <h1>
            Plan your event. <em>Keep the details together.</em>
          </h1>
          <p className="lead">
            Create an event brief, organize planning tasks, explore available services and follow bookings from one workspace.
          </p>
          <div className="esg-ctas">
            <button type="button" className="esg-btn p" onClick={launch}>
              Start planning an event
            </button>
            {onDownloadAndroid && (
              <button type="button" className="esg-btn g" onClick={onDownloadAndroid}>
                Download for Android
              </button>
            )}
          </div>
          <div className="esg-trust">
            <span>
              <i>✓</i> Event planning workspace
            </span>
            <span>
              <i>✓</i> Marketplace listings
            </span>
            <span>
              <i>✓</i> Booking status
            </span>
            <span>
              <i>✓</i> Tasks and readiness
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="esg-stats">
        <div className="esg-w">
          {STATS.map((s) => (
            <div key={s.l}>
              <strong className={s.c}>{s.v}</strong>
              <small>{s.l}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="esg-sec" id="features">
        <div className="esg-w">
          <div className="eye">Plan and coordinate</div>
          <h2>Tools for your event workspace</h2>
          <p className="sub">Keep event details, services, payments and follow-up connected as your plan takes shape.</p>
          <div className="esg-grid2">
            {FEATURES.map((f) => (
              <article key={f.title} className="esg-card">
                <div className={`esg-ico ${f.cls}`}>{f.ico}</div>
                <h3>{f.title}</h3>
                <p style={{ color: "var(--primary)", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{f.sub}</p>
                <p>{f.body}</p>
                <ul className="esg-ul">
                  {f.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="esg-metric">
                  <b>{f.metric}</b>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section className="esg-sec" id="how" style={{ background: "rgba(15,23,42,.45)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="esg-w">
          <div className="eye">A clear next step</div>
          <h2>From event idea to follow-up</h2>
          <p className="sub">Move through planning at your pace and review booking details before confirming.</p>
          <div className="esg-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="esg-step">
                <div className="num">{s.n}</div>
                <h3>{s.t}</h3>
                <p style={{ margin: 0, color: "var(--mute)", fontSize: 13 }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button type="button" className="esg-btn p" onClick={launch}>
              Start planning →
            </button>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="esg-sec">
        <div className="esg-w">
          <div className="eye">Every scale</div>
          <h2>One workspace for different occasions</h2>
          <p className="sub">Organize the details that matter for the event you are planning.</p>
          <div className="esg-grid4">
            {USE.map((u) => (
              <article key={u.t} className="esg-card">
                <div className="esg-ico cyan">{u.ico}</div>
                <h3>{u.t}</h3>
                <p>{u.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="esg-sec" id="marketplace" style={{ background: "rgba(15,23,42,.45)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="esg-w">
          <div className="eye">Marketplace</div>
          <h2>Explore available event services</h2>
          <p className="sub">Listing availability, locations and service details are shown in the marketplace.</p>
          <div className="esg-grid3">
            {CATS.map((c) => (
              <article key={c.t} className="esg-card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="esg-ico cyan" style={{ width: 42, height: 42, fontSize: 18, flexShrink: 0 }}>
                  {c.ico}
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{c.t}</h3>
                  <p style={{ margin: 0, fontSize: 12 }}>{c.d}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="esg-band">
            <div>
              <h3>Do you provide event services?</h3>
              <p style={{ margin: 0, color: "var(--mute)", fontSize: 14 }}>Create a provider account to submit your details and manage service listings.</p>
            </div>
            <button type="button" className="esg-btn p" onClick={() => openAuth("VENDOR")}>
              Become a vendor
            </button>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="esg-sec">
        <div className="esg-w">
          <div className="eye">Payment visibility</div>
          <h2>Escrow protection for both sides</h2>
          <p className="sub">Booking funds are held until the configured verification and release conditions are met.</p>
          <div className="esg-grid3">
            {[
              ["🧾", "Clear booking amount", "Review the amount and booking details before confirming a payment."],
              ["🔒", "Payer protection", "Funds remain in platform-controlled escrow until the event is complete and every service check is green."],
              ["✓", "Payee protection", "The assigned lead verifier authorizes release after event completion; the vendor payout is then credited to their wallet."],
            ].map(([ico, t, d]) => (
              <article key={t} className="esg-card">
                <div className="esg-ico em">{ico}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile */}
      <section className="esg-sec" id="mobile" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="esg-w" style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 40, alignItems: "center" }}>
          <div>
            <div className="esg-badge">📱 Mobile-friendly planning</div>
            <h2 style={{ textAlign: "left", marginBottom: 12 }}>Keep your event moving on the go</h2>
            <p style={{ color: "var(--mute)", marginBottom: 16 }}>
              Open the web experience from your phone to review event details, tasks and booking updates.
            </p>
            <ul className="esg-ul">
              {["Review your event workspace", "Follow tasks and readiness", "Check booking information", "Continue planning from your phone"].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="esg-ctas" style={{ justifyContent: "flex-start", marginTop: 20 }}>
              {onDownloadAndroid && (
                <button type="button" className="esg-btn g" onClick={onDownloadAndroid}>
                  Get the Android app
                </button>
              )}
              <button type="button" className="esg-btn g" onClick={launch}>
                Start planning
              </button>
            </div>
            {!onDownloadAndroid && <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 12 }}>An official Android download link is not configured on this page.</p>}
          </div>
          <div className="esg-phone" aria-hidden>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="esg-mark" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <ShieldIcon size={14} />
              </div>
              <strong style={{ fontSize: 12 }}>EPHINTA</strong>
            </div>
            <div className="p-card">
              <div style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700, textTransform: "uppercase" }}>Event brief</div>
              <b>My event</b>
              <div style={{ fontSize: 10, color: "var(--mute)" }}>Planning workspace</div>
            </div>
            <div className="p-grid">
              {["Details", "Tasks", "Guests", "Budget"].map((t) => (
                <div key={t}>{t}</div>
              ))}
            </div>
            <div className="p-card">
              <div style={{ fontSize: 10, color: "var(--mute)" }}>Example planning snapshot</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Your next step</div>
              <div style={{ fontSize: 10, color: "var(--mute)" }}>Review event details</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="esg-sec" id="pricing">
        <div className="esg-w">
          <div className="eye">Costs and payments</div>
          <h2>Review the details before you book</h2>
          <p className="sub">Prices, applicable fees and payment options depend on the listing and configuration. Check the complete total at checkout before confirming.</p>
          <div className="esg-grid3">
            {[
              ["Compare", "Review listing prices and service details before choosing."],
              ["Confirm", "Check the booking total and available payment options at checkout."],
              ["Track", "Follow payment and escrow status from the booking and wallet records."],
            ].map(([title, description]) => (
              <article key={title} className="esg-card">
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Global */}
      <section className="esg-sec" style={{ paddingTop: 24 }}>
        <div className="esg-w">
          <div className="eye">Availability</div>
          <h2>Check what is available for your event</h2>
          <p className="sub">Marketplace listings, supported currencies and payment options vary by location. Review current availability in the app before making plans or payments.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="esg-sec" id="faq">
        <div className="esg-w" style={{ maxWidth: 720 }}>
          <div className="eye">Questions</div>
          <h2>Before you start</h2>
          <p className="sub">Straight answers about planning, bookings and availability.</p>
          <div className="esg-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="esg-cta">
        <div className="esg-w">
          <div className="esg-badge">Start with your event brief</div>
          <h2 style={{ marginBottom: 12 }}>Ready to plan the event you imagine?</h2>
          <p className="sub" style={{ marginBottom: 24 }}>
            Begin with a plan, then review available services and payment details when you are ready.
          </p>
          <div className="esg-ctas">
            <button type="button" className="esg-btn p" onClick={launch}>
              Start planning an event
            </button>
            {onDownloadAndroid && (
              <button type="button" className="esg-btn g" onClick={onDownloadAndroid}>
                Download Android app
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="esg-ft">
        <div className="esg-w">
          <div className="esg-ft-grid">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <img src="/brand/ephinta_logo2.png" alt="" className="esg-brand-image esg-brand-image--footer" />
                <strong className="esg-brand">EPHINTA</strong>
              </div>
              <p style={{ margin: "0 0 14px", color: "var(--mute)", fontSize: 13, maxWidth: 260 }}>
                Event Self Solutions. Plan your event and keep the details together.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="esg-btn p" style={{ padding: "8px 14px", fontSize: 12 }} onClick={launch}>
                  Launch Portal
                </button>
                {onDownloadAndroid && (
                  <button type="button" className="esg-btn g" style={{ padding: "8px 14px", fontSize: 12 }} onClick={onDownloadAndroid}>
                    Android
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                {NAV.map(([id, label]) => (
                  <li key={id}>
                    <button type="button" className="link" onClick={() => go(id)}>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Payments and planning</h4>
              <ul style={{ color: "var(--mute)", fontSize: 13 }}>
                <li>Event details and tasks</li>
                <li>Marketplace listings</li>
                <li>Booking payment status</li>
                <li>Wallet activity</li>
              </ul>
            </div>
            <div>
              <h4>Get started</h4>
              <ul style={{ color: "var(--mute)", fontSize: 13 }}>
                <li>Start an event brief from the top of this page.</li>
                <li>Providers can use the vendor sign-up option in the menu.</li>
              </ul>
            </div>
          </div>
          <div className="esg-ft-bot">
            <span>© {new Date().getFullYear()} Events Self Service Solutions. All rights reserved.</span>
            <span>Availability and payment options are shown in the app.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

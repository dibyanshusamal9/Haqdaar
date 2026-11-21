"use client";

import { ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ProfileDraft, REQUIRED, STATES } from "@/api/haqdaar";

type Key = keyof ProfileDraft;

interface Props {
  draft: ProfileDraft;
  filled: Set<Key>;
  onChange: (key: Key, value: string | boolean) => void;
}

/** UC-03 / FR-04: every value, typed or extracted, is shown and editable here. */
export default function ProfileForm({ draft, filled, onChange }: Props) {
  const { t } = useLanguage();
  const f = t.check.fields as Record<string, string>;

  const Field = ({ k, children, hint }: { k: Key; children: ReactNode; hint?: string }) => (
    <div className={`hq-field ${filled.has(k) ? "is-filled" : ""}`}>
      <label htmlFor={`f-${k}`} className="hq-label">
        {f[k]}
        {REQUIRED.includes(k) && <span className="hq-req">{t.check.required}</span>}
        {filled.has(k) && <span className="hq-from-voice">{t.check.fromVoice}</span>}
      </label>
      {children}
      {hint && <span className="hq-hint">{hint}</span>}
    </div>
  );

  const select = (k: Key, values: string[], labels?: Record<string, string>) => (
    <select id={`f-${k}`} className="hq-select" value={String(draft[k])} onChange={(e) => onChange(k, e.target.value)}>
      <option value="">{t.check.select}</option>
      {values.map((v) => (
        <option key={v} value={v}>{labels?.[v] ?? v}</option>
      ))}
    </select>
  );

  const yesNo = (k: Key) => (
    <div className={`hq-field ${filled.has(k) ? "is-filled" : ""}`}>
      <div className="hq-toggle-row">
        <span id={`f-${k}`} className="hq-label" style={{ fontWeight: 500 }}>
          {f[k]}
          {filled.has(k) && <span className="hq-from-voice">{t.check.fromVoice}</span>}
        </span>
        <div className="hq-yesno" role="group" aria-labelledby={`f-${k}`}>
          <button type="button" aria-pressed={draft[k] === true} onClick={() => onChange(k, true)}>{t.check.yes}</button>
          <button type="button" aria-pressed={draft[k] === false} onClick={() => onChange(k, false)}>{t.check.no}</button>
        </div>
      </div>
    </div>
  );

  const o = t.options;

  return (
    <div>
      <p className="hq-notice info" style={{ marginTop: 4 }}>{t.check.forWhomNote}</p>

      <h3 className="hq-section-title">{t.check.sectionAbout}</h3>
      <div className="hq-grid">
        {Field({
          k: "age",
          children: (
            <input id="f-age" className="hq-input" type="number" inputMode="numeric" min={0} max={120} value={draft.age} onChange={(e) => onChange("age", e.target.value)} />
          ),
        })}
        {Field({ k: "gender", children: select("gender", Object.keys(o.gender), o.gender) })}
        {Field({ k: "marital_status", children: select("marital_status", Object.keys(o.marital_status), o.marital_status) })}
      </div>

      <h3 className="hq-section-title">{t.check.sectionPlace}</h3>
      <div className="hq-grid">
        {Field({ k: "state", children: select("state", STATES) })}
        {Field({ k: "residence", children: select("residence", Object.keys(o.residence), o.residence) })}
      </div>

      <h3 className="hq-section-title">{t.check.sectionCommunity}</h3>
      <div className="hq-grid">
        {Field({ k: "caste", children: select("caste", Object.keys(o.caste), o.caste) })}
        {Field({
          k: "annual_income",
          hint: f.annual_income_hint,
          children: (
            <input id="f-annual_income" className="hq-input" type="text" inputMode="numeric" placeholder="₹" value={draft.annual_income} onChange={(e) => onChange("annual_income", e.target.value.replace(/[^\d]/g, ""))} />
          ),
        })}
      </div>
      <div style={{ marginTop: 8 }}>
        {yesNo("bpl")}
        {yesNo("minority")}
      </div>

      <h3 className="hq-section-title">{t.check.sectionWork}</h3>
      <div className="hq-grid">
        {Field({ k: "occupation", children: select("occupation", Object.keys(o.occupation), o.occupation) })}
        {Field({ k: "employment_status", children: select("employment_status", Object.keys(o.employment_status), o.employment_status) })}
      </div>
      <div style={{ marginTop: 8 }}>
        {yesNo("student")}
        {yesNo("gov_employee")}
      </div>

      <h3 className="hq-section-title">{t.check.sectionSupport}</h3>
      {yesNo("disability")}
      {draft.disability && (
        <div className="hq-grid" style={{ margin: "8px 0" }}>
          {Field({
            k: "disability_percent",
            children: (
              <input id="f-disability_percent" className="hq-input" type="number" inputMode="numeric" min={0} max={100} value={draft.disability_percent} onChange={(e) => onChange("disability_percent", e.target.value)} />
            ),
          })}
        </div>
      )}
      {yesNo("economic_distress")}
    </div>
  );
}

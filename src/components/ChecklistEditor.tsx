import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { checklistRules, MAX_CHECKLIST_RULES, type ChecklistRule } from '../core/checklist';

export default function ChecklistEditor({
  rules,
  onChange,
}: {
  rules: ChecklistRule[];
  onChange: (rules: ChecklistRule[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ChecklistRule['kind']>('name');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  return (
    <section className="panel checklist-editor">
      <div className="section-heading">
        <h3>Définir mes critères</h3>
        <span>
          {rules.length} / {MAX_CHECKLIST_RULES}
        </span>
      </div>
      <p>
        Choisissez ce que votre ZIP doit contenir. Les critères sont conservés dans ce navigateur,
        sans sauvegarder vos fichiers.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = checklistRules([{ label, kind, target }]);
          if (!next.length) {
            setError('Saisissez un libellé et une valeur attendue valides.');
            return;
          }
          if (rules.length >= MAX_CHECKLIST_RULES) {
            setError('La limite est de 20 critères.');
            return;
          }
          onChange([...rules, next[0]!]);
          setLabel('');
          setTarget('');
          setError('');
        }}
      >
        <label>
          Nom du critère
          <input
            aria-label="Nom du critère"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="Page d’accueil"
            required
          />
        </label>
        <label>
          Rechercher
          <select
            aria-label="Type de critère"
            value={kind}
            onChange={(e) => setKind(e.target.value as ChecklistRule['kind'])}
          >
            <option value="name">Fichier</option>
            <option value="extension">Extension</option>
            <option value="folder">Dossier</option>
          </select>
        </label>
        <label>
          Valeur attendue
          <input
            aria-label="Valeur attendue"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={160}
            placeholder={kind === 'name' ? 'index.html' : kind === 'extension' ? '.pdf' : 'assets'}
            required
          />
        </label>
        <button className="secondary-button" disabled={rules.length >= MAX_CHECKLIST_RULES}>
          <Plus size={16} />
          Ajouter le critère
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="panel-footnote">
        Noms et chemins exacts, sans distinction de casse. Un dossier est repéré par les fichiers
        qu’il contient. Aucun code n’est exécuté.
      </p>
      <div className="custom-rule-list">
        {rules.map((rule, i) => (
          <div key={i}>
            <span>
              <strong>{rule.label}</strong>
              <small>{rule.target}</small>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Supprimer le critère ${rule.label}`}
              onClick={() => onChange(rules.filter((_, j) => j !== i))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {!rules.length && (
        <p>
          Ajoutez votre premier critère : par exemple index.html pour un site, .pdf pour des
          documents ou assets pour des médias.
        </p>
      )}
    </section>
  );
}

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  inicialitzaDrive, estaConfigurat, connecta, estaConnectat, desconnecta,
  desaAlDrive, carregaDelDrive,
} from "./drive";

// ============ Configuració inicial dels blocs de criteris ============
const BLOCS_INICIALS = [
  { id: "examens", nom: "Exàmens", color: "#2563EB", tint: "#EFF4FE", pes: 0.4, editable: true,
    criteris: ["Recuperació", "Examen 1", "Examen 2"] },
  { id: "practica", nom: "Pràctica", color: "#059669", tint: "#ECFDF5", pes: 0.4, editable: true,
    criteris: ["Ritme 1", "Ritme 2", "Solfeig 1", "Solfeig 2", "Interpretació 1", "Interpretació 2", "Flauta"] },
  { id: "actitud", nom: "Actitud", color: "#D97706", tint: "#FEF6E9", pes: 0.2, editable: false,
    criteris: ["Actitud"] },
];

const AVALUACIONS = ["1a avaluació", "2a avaluació", "3a avaluació"];

// ============ Utilitats de càlcul ============
function mitjanaValida(valors) {
  const nums = valors.filter((v) => v !== "" && v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mitjanaBloc(alumne, avalIdx, bloc) {
  const valors = bloc.criteris.map((cr) => alumne.notes[`${avalIdx}|${bloc.id}|${cr}`]);
  const m = mitjanaValida(valors);
  return m === null ? null : Math.round(m * 100) / 100;
}

function notaAvaluacio(alumne, avalIdx, blocs) {
  let sumaPes = 0, sumaVal = 0;
  for (const bloc of blocs) {
    const m = mitjanaBloc(alumne, avalIdx, bloc);
    if (m !== null) { sumaPes += bloc.pes; sumaVal += m * bloc.pes; }
  }
  if (sumaPes === 0) return null;
  return Math.round((sumaVal / sumaPes) * 100) / 100;
}

function notaAcumulada(alumne, avalIdx, blocs) {
  const notes = [];
  for (let i = 0; i <= avalIdx; i++) {
    const n = notaAvaluacio(alumne, i, blocs);
    if (n !== null) notes.push(n);
  }
  if (notes.length === 0) return null;
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100;
}

function colorNota(n) {
  if (n === null) return "var(--text-muted)";
  if (n < 5) return "#B91C1C";
  if (n >= 9) return "#15803D";
  return "#1E293B";
}
function fonsNota(n) {
  if (n === null) return "transparent";
  if (n < 5) return "#FEE2E2";
  if (n >= 9) return "#DCFCE7";
  return "transparent";
}
function escalaColor(n) {
  if (n <= 5) { const t = n / 5; return `rgb(252, ${165 + t * 74}, ${165 - t * 3})`; }
  const t = (n - 5) / 5; return `rgb(${254 - t * 120}, 240, ${138 - t * 6})`;
}

// ============ Estat inicial ============
function clonaBlocs() {
  return BLOCS_INICIALS.map((b) => ({ ...b, criteris: [...b.criteris] }));
}
function nouAlumne(id) { return { id, cognom1: "", cognom2: "", nom: "", notes: {} }; }
function nouCurs(nom) {
  return { id: crypto.randomUUID(), nom, blocs: clonaBlocs(),
    alumnes: Array.from({ length: 5 }, () => nouAlumne(crypto.randomUUID())) };
}
const CURSOS_INICIALS = ["1r ESO", "2n ESO", "3r ESO", "4t ESO", "Optativa"].map(nouCurs);

export default function App() {
  const [cursos, setCursos] = useState(CURSOS_INICIALS);
  const [cursActiu, setCursActiu] = useState(CURSOS_INICIALS[0].id);
  const [avalActiva, setAvalActiva] = useState(0);
  const [afegintCurs, setAfegintCurs] = useState(false);
  const [nomNouCurs, setNomNouCurs] = useState("");
  const [confirmacio, setConfirmacio] = useState(null);
  const [errorCarrega, setErrorCarrega] = useState("");
  const [afegintColumna, setAfegintColumna] = useState(null); // id del bloc on s'afig
  const [nomNovaColumna, setNomNovaColumna] = useState("");
  const [importObert, setImportObert] = useState(false);
  const [textImport, setTextImport] = useState("");
  const [modeImport, setModeImport] = useState("afegir"); // "afegir" o "reemplacar"
  const [driveLlest, setDriveLlest] = useState(false);
  const [connectat, setConnectat] = useState(false);
  const [estatDrive, setEstatDrive] = useState(""); // missatge d'estat: desant, carregant, desat…
  const [canvisSenseDesar, setCanvisSenseDesar] = useState(false);
  const fileInputRef = useRef(null);

  // Inicialitza Google Drive en arrencar
  useEffect(() => {
    if (!estaConfigurat()) return;
    inicialitzaDrive()
      .then(() => setDriveLlest(true))
      .catch(() => setEstatDrive("No s'ha pogut inicialitzar Google Drive."));
  }, []);

  const curs = cursos.find((c) => c.id === cursActiu) || cursos[0];
  const blocs = curs?.blocs || BLOCS_INICIALS;

  // Marca que hi ha canvis pendents de desar (ignora el primer render)
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    setCanvisSenseDesar(true);
  }, [cursos]);

  // Avisa si es tanca la pestanya amb canvis sense desar
  useEffect(() => {
    function abansDeTancar(e) {
      if (canvisSenseDesar) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", abansDeTancar);
    return () => window.removeEventListener("beforeunload", abansDeTancar);
  }, [canvisSenseDesar]);

  // ---- Cursos ----
  function afegirCurs() {
    const nom = nomNouCurs.trim();
    if (!nom) return;
    const nc = nouCurs(nom);
    setCursos([...cursos, nc]); setCursActiu(nc.id); setNomNouCurs(""); setAfegintCurs(false);
  }
  function eliminarCurs(id) {
    const c = cursos.find((x) => x.id === id);
    setConfirmacio({
      missatge: `Vols eliminar el curs "${c.nom}"? S'esborraran totes les seues notes.`,
      accio: () => {
        const restants = cursos.filter((x) => x.id !== id);
        setCursos(restants);
        if (cursActiu === id && restants.length) setCursActiu(restants[0].id);
      },
    });
  }

  // ---- Columnes (criteris) — individuals per grup ----
  function afegirColumna(blocId) {
    const nom = nomNovaColumna.trim();
    if (!nom) return;
    const nousBlocs = blocs.map((b) => {
      if (b.id !== blocId) return b;
      if (b.criteris.includes(nom)) return b; // evita duplicats
      return { ...b, criteris: [...b.criteris, nom] };
    });
    actualitzaCurs({ ...curs, blocs: nousBlocs });
    setNomNovaColumna(""); setAfegintColumna(null);
  }
  function eliminarColumna(blocId, criteri) {
    const bloc = blocs.find((b) => b.id === blocId);
    if (bloc.criteris.length <= 1) {
      setConfirmacio({ missatge: `No pots eliminar l'última columna del bloc "${bloc.nom}". Un bloc ha de tindre almenys un criteri.`, nomesInfo: true });
      return;
    }
    setConfirmacio({
      missatge: `Vols eliminar la columna "${criteri}" del bloc "${bloc.nom}" del grup "${curs.nom}"? S'esborraran aquestes notes en totes les avaluacions d'aquest grup.`,
      accio: () => {
        const nousBlocs = blocs.map((b) => b.id === blocId ? { ...b, criteris: b.criteris.filter((c) => c !== criteri) } : b);
        const nousAlumnes = curs.alumnes.map((al) => {
          const notes = { ...al.notes };
          for (const k of Object.keys(notes)) {
            if (k.endsWith(`|${blocId}|${criteri}`)) delete notes[k];
          }
          return { ...al, notes };
        });
        actualitzaCurs({ ...curs, blocs: nousBlocs, alumnes: nousAlumnes });
      },
    });
  }

  // ---- Alumnes ----
  function actualitzaCurs(nc) { setCursos(cursos.map((c) => (c.id === nc.id ? nc : c))); }
  function afegirAlumne() { actualitzaCurs({ ...curs, alumnes: [...curs.alumnes, nouAlumne(crypto.randomUUID())] }); }

  // Interpreta el text enganxat des d'Excel (columnes separades per tabulador o ; o ,)
  function analitzaText(text) {
    const linies = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    const alumnes = [];
    for (const linia of linies) {
      // Excel separa columnes amb tabulador en copiar; admetem també ; i , com a alternativa
      let parts;
      if (linia.includes("\t")) parts = linia.split("\t");
      else if (linia.includes(";")) parts = linia.split(";");
      else parts = linia.split(/,|\s{2,}/); // coma o dos+ espais
      parts = parts.map((p) => p.trim());
      const [cognom1 = "", cognom2 = "", nom = ""] = parts;
      // Ignora una possible fila de capçalera
      const potserCapcalera = /^(cognom|cognoms|nom|alumne|apellido)/i.test(cognom1);
      if (potserCapcalera && alumnes.length === 0) continue;
      if (!cognom1 && !cognom2 && !nom) continue;
      alumnes.push({ id: crypto.randomUUID(), cognom1, cognom2, nom, notes: {} });
    }
    return alumnes;
  }

  function previsualitzaImport() {
    return analitzaText(textImport);
  }

  function confirmaImport() {
    const nous = analitzaText(textImport);
    if (nous.length === 0) return;
    if (modeImport === "reemplacar") {
      actualitzaCurs({ ...curs, alumnes: nous });
    } else {
      // Afegir: si les últimes files estan buides, les substituïm pels importats
      const existents = curs.alumnes.filter((a) => a.cognom1 || a.cognom2 || a.nom || Object.keys(a.notes).length);
      actualitzaCurs({ ...curs, alumnes: [...existents, ...nous] });
    }
    setImportObert(false);
    setTextImport("");
  }
  function eliminarAlumne(aid) {
    const al = curs.alumnes.find((a) => a.id === aid);
    const nomComplet = [al.nom, al.cognom1, al.cognom2].filter(Boolean).join(" ").trim();
    setConfirmacio({
      missatge: nomComplet ? `Vols eliminar ${nomComplet} de la llista?` : "Vols eliminar aquesta fila?",
      accio: () => actualitzaCurs({ ...curs, alumnes: curs.alumnes.filter((a) => a.id !== aid) }),
    });
  }
  function editaAlumne(aid, camp, valor) {
    actualitzaCurs({ ...curs, alumnes: curs.alumnes.map((a) => (a.id === aid ? { ...a, [camp]: valor } : a)) });
  }
  function editaNota(aid, blocId, criteri, valor) {
    if (valor !== "") { const num = Number(valor); if (isNaN(num) || num < 0 || num > 10) return; }
    const key = `${avalActiva}|${blocId}|${criteri}`;
    actualitzaCurs({ ...curs, alumnes: curs.alumnes.map((a) => a.id === aid ? { ...a, notes: { ...a.notes, [key]: valor } } : a) });
  }

  // ---- Google Drive: connexió ----
  async function connectaDrive() {
    try {
      setEstatDrive("Connectant amb Google…");
      await connecta();
      setConnectat(true);
      setEstatDrive("Connectat. Carregant les dades…");
      const dades = await carregaDelDrive();
      if (dades && dades.cursos && Array.isArray(dades.cursos)) {
        aplicaDades(dades);
        setEstatDrive("Dades carregades des del Drive.");
        setCanvisSenseDesar(false);
      } else {
        setEstatDrive("Connectat. Encara no hi ha cap fitxer desat: prem Desar per crear-lo.");
      }
    } catch (err) {
      setEstatDrive("No s'ha pogut connectar amb Google. Torna-ho a provar.");
      setConnectat(false);
    }
  }

  function desconnectaDrive() {
    desconnecta();
    setConnectat(false);
    setEstatDrive("Desconnectat de Google Drive.");
  }

  function aplicaDades(data) {
    const blocsGlobalsAntics = (data.blocs && Array.isArray(data.blocs)) ? data.blocs : null;
    const cursosMigrats = data.cursos.map((cs) => ({
      ...cs,
      blocs: cs.blocs && Array.isArray(cs.blocs)
        ? cs.blocs
        : (blocsGlobalsAntics ? blocsGlobalsAntics.map((b) => ({ ...b, criteris: [...b.criteris] })) : clonaBlocs()),
    }));
    setCursos(cursosMigrats);
    setCursActiu(cursosMigrats[0]?.id);
  }

  // ---- Desar / carregar (Drive si està connectat; si no, fitxer local) ----
  async function desar() {
    const dades = { versio: 2, cursos };
    if (connectat) {
      try {
        setEstatDrive("Desant al Drive…");
        await desaAlDrive(dades);
        setEstatDrive(`Desat al Drive · ${new Date().toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" })}`);
        setCanvisSenseDesar(false);
      } catch (err) {
        setEstatDrive("Error en desar al Drive. Prova de descarregar una còpia local.");
      }
    } else {
      desarLocal(dades);
    }
  }

  function desarLocal(dades) {
    const blob = new Blob([JSON.stringify(dades, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `notes_musica_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    setCanvisSenseDesar(false);
  }

  async function recarregaDelDrive() {
    if (!connectat) return;
    try {
      setEstatDrive("Carregant del Drive…");
      const dades = await carregaDelDrive();
      if (dades && dades.cursos) {
        aplicaDades(dades);
        setEstatDrive("Dades actualitzades des del Drive.");
        setCanvisSenseDesar(false);
      } else {
        setEstatDrive("Encara no hi ha cap fitxer desat al Drive.");
      }
    } catch (err) {
      setEstatDrive("No s'han pogut carregar les dades del Drive.");
    }
  }

  function carregar(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cursos && Array.isArray(data.cursos)) {
          aplicaDades(data); setErrorCarrega("");
        } else { setErrorCarrega("El fitxer no té el format esperat de notes."); }
      } catch (err) { setErrorCarrega("No s'ha pogut llegir el fitxer. Comprova que és un fitxer de notes vàlid."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  // ---- Estadístiques ----
  const stats = useMemo(() => {
    const acumulades = curs.alumnes.map((a) => notaAcumulada(a, avalActiva, blocs)).filter((n) => n !== null);
    const total = acumulades.length;
    const mitjana = total ? acumulades.reduce((a, b) => a + b, 0) / total : null;
    return { total, mitjana, suspesos: acumulades.filter((n) => n < 5).length, excel: acumulades.filter((n) => n >= 9).length };
  }, [curs, avalActiva, blocs]);

  return (
    <div style={styles.page}>
      <style>{cssGlobal}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>♪</div>
          <div>
            <h1 style={styles.title}>Quadern de notes</h1>
            <p style={styles.subtitle}>Música · ESO</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          {estaConfigurat() ? (
            connectat ? (
              <>
                <button style={styles.btnGhost} onClick={recarregaDelDrive} title="Tornar a llegir les dades del Drive">Actualitzar</button>
                <button style={styles.btnGhost} onClick={desconnectaDrive}>Desconnectar</button>
                <button style={styles.btnPrimary} onClick={desar}>
                  {canvisSenseDesar ? "Desar •" : "Desar"}
                </button>
              </>
            ) : (
              <button style={styles.btnPrimary} onClick={connectaDrive} disabled={!driveLlest}>
                {driveLlest ? "Connectar amb Google Drive" : "Preparant Drive…"}
              </button>
            )
          ) : (
            <>
              <button style={styles.btnGhost} onClick={() => fileInputRef.current?.click()}>Carregar</button>
              <button style={styles.btnPrimary} onClick={desar}>{canvisSenseDesar ? "Desar •" : "Desar"}</button>
            </>
          )}
          <input ref={fileInputRef} type="file" accept=".json" onChange={carregar} style={{ display: "none" }} />
        </div>
      </header>

      {estatDrive && (
        <div style={styles.estatBar}>
          <span>{estatDrive}</span>
          {connectat && canvisSenseDesar && <span style={styles.pendent}>Tens canvis sense desar</span>}
        </div>
      )}

      <div style={styles.cursosBar}>
        {cursos.map((c) => (
          <div key={c.id} style={{ ...styles.cursTab, ...(c.id === cursActiu ? styles.cursTabActiu : {}) }} onClick={() => setCursActiu(c.id)}>
            <span>{c.nom}</span>
            <button style={styles.cursTancar} onClick={(e) => { e.stopPropagation(); eliminarCurs(c.id); }} title="Eliminar curs" aria-label={`Eliminar ${c.nom}`}>×</button>
          </div>
        ))}
        {afegintCurs ? (
          <div style={styles.cursAfegirForm}>
            <input autoFocus style={styles.cursInput} value={nomNouCurs} placeholder="Nom del curs"
              onChange={(e) => setNomNouCurs(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") afegirCurs(); if (e.key === "Escape") { setAfegintCurs(false); setNomNouCurs(""); } }} />
            <button style={styles.btnMini} onClick={afegirCurs}>Afegir</button>
          </div>
        ) : (
          <button style={styles.cursAfegir} onClick={() => setAfegintCurs(true)}>+ Curs</button>
        )}
      </div>

      {errorCarrega && (
        <div style={styles.errorBanner}>
          <span>{errorCarrega}</span>
          <button style={styles.errorTancar} onClick={() => setErrorCarrega("")} aria-label="Tancar">×</button>
        </div>
      )}

      {cursos.length === 0 ? (
        <div style={styles.buit}><p>No hi ha cap curs. Afig-ne un per començar.</p></div>
      ) : (
        <>
          <div style={styles.subBar}>
            <div style={styles.avalTabs}>
              {AVALUACIONS.map((a, i) => (
                <button key={i} style={{ ...styles.avalTab, ...(i === avalActiva ? styles.avalTabActiu : {}) }} onClick={() => setAvalActiva(i)}>{a}</button>
              ))}
            </div>
            <div style={styles.stats}>
              <Stat etiqueta="Alumnes" valor={stats.total} />
              <Stat etiqueta="Mitjana" valor={stats.mitjana !== null ? stats.mitjana.toFixed(2) : "—"} />
              <Stat etiqueta="Suspesos" valor={stats.suspesos} color="#B91C1C" />
              <Stat etiqueta="Excel·lents" valor={stats.excel} color="#15803D" />
            </div>
          </div>

          <div style={styles.taulaWrap}>
            <table style={styles.taula}>
              <thead>
                <tr>
                  <th style={{ ...styles.thAlumnat }} colSpan={3}>Alumnat</th>
                  {blocs.map((b) => (
                    <th key={b.id} colSpan={b.criteris.length + (b.editable ? 1 : 0)} style={{ ...styles.thBloc, background: b.color }}>
                      {b.nom}
                    </th>
                  ))}
                  {blocs.filter(b => b.id !== "actitud").map((b) => (
                    <th key={"m" + b.id} style={{ ...styles.thBloc, background: "#475569" }}>Mitj. {b.nom.toLowerCase()}</th>
                  ))}
                  <th style={{ ...styles.thBloc, background: "#7C3AED" }}>Nota aval.</th>
                  <th style={{ ...styles.thBloc, background: "#DB2777" }}>Contínua</th>
                  <th style={styles.thAccions}></th>
                </tr>
                <tr>
                  <th style={{ ...styles.thSub, ...styles.stickyCol1 }}>Cognom 1</th>
                  <th style={{ ...styles.thSub, ...styles.stickyCol2 }}>Cognom 2</th>
                  <th style={{ ...styles.thSub, ...styles.stickyCol3 }}>Nom</th>
                  {blocs.map((b) => (
                    <React.Fragment key={b.id}>
                      {b.criteris.map((cr) => (
                        <th key={b.id + cr} style={{ ...styles.thSub, color: b.color }}>
                          <div style={styles.thCriteriWrap}>
                            <span>{cr}</span>
                            {b.editable && (
                              <button style={styles.colTancar} onClick={() => eliminarColumna(b.id, cr)} title={`Eliminar ${cr}`} aria-label={`Eliminar columna ${cr}`}>×</button>
                            )}
                          </div>
                        </th>
                      ))}
                      {b.editable && (
                        <th style={{ ...styles.thSub, background: b.tint }}>
                          {afegintColumna === b.id ? (
                            <div style={styles.colAfegirForm}>
                              <input autoFocus style={styles.colInput} value={nomNovaColumna} placeholder="Nom"
                                onChange={(e) => setNomNovaColumna(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") afegirColumna(b.id); if (e.key === "Escape") { setAfegintColumna(null); setNomNovaColumna(""); } }} />
                              <button style={{ ...styles.colAfegirBtn, background: b.color }} onClick={() => afegirColumna(b.id)}>✓</button>
                            </div>
                          ) : (
                            <button style={{ ...styles.colAfegir, color: b.color, borderColor: b.color }} onClick={() => { setAfegintColumna(b.id); setNomNovaColumna(""); }} title={`Afegir columna a ${b.nom}`}>+</button>
                          )}
                        </th>
                      )}
                    </React.Fragment>
                  ))}
                  {blocs.filter(b => b.id !== "actitud").map((b) => (<th key={"ms" + b.id} style={styles.thSub}></th>))}
                  <th style={styles.thSub}></th>
                  <th style={styles.thSub}></th>
                  <th style={styles.thSub}></th>
                </tr>
              </thead>
              <tbody>
                {curs.alumnes.map((a, idx) => {
                  const nAval = notaAvaluacio(a, avalActiva, blocs);
                  const nAcu = notaAcumulada(a, avalActiva, blocs);
                  return (
                    <tr key={a.id} style={idx % 2 ? styles.trAlt : undefined}>
                      <td style={{ ...styles.tdNom, ...styles.stickyCol1, ...(idx % 2 ? styles.stickyAlt : styles.stickyNormal) }}>
                        <input style={styles.inputNom} value={a.cognom1} onChange={(e) => editaAlumne(a.id, "cognom1", e.target.value)} />
                      </td>
                      <td style={{ ...styles.tdNom, ...styles.stickyCol2, ...(idx % 2 ? styles.stickyAlt : styles.stickyNormal) }}>
                        <input style={styles.inputNom} value={a.cognom2} onChange={(e) => editaAlumne(a.id, "cognom2", e.target.value)} />
                      </td>
                      <td style={{ ...styles.tdNom, ...styles.stickyCol3, ...(idx % 2 ? styles.stickyAlt : styles.stickyNormal) }}>
                        <input style={styles.inputNom} value={a.nom} onChange={(e) => editaAlumne(a.id, "nom", e.target.value)} />
                      </td>
                      {blocs.map((b) => (
                        <React.Fragment key={b.id}>
                          {b.criteris.map((cr) => {
                            const key = `${avalActiva}|${b.id}|${cr}`;
                            const val = a.notes[key] ?? "";
                            const nv = val === "" ? null : Number(val);
                            return (
                              <td key={key} style={styles.tdNota}>
                                <input style={{ ...styles.inputNota, color: colorNota(nv), background: fonsNota(nv), fontWeight: nv !== null && (nv < 5 || nv >= 9) ? 600 : 400 }}
                                  value={val} inputMode="decimal" onChange={(e) => editaNota(a.id, b.id, cr, e.target.value)} />
                              </td>
                            );
                          })}
                          {b.editable && <td style={styles.tdBuit}></td>}
                        </React.Fragment>
                      ))}
                      {blocs.filter(b => b.id !== "actitud").map((b) => {
                        const m = mitjanaBloc(a, avalActiva, b);
                        return (
                          <td key={"mv" + b.id} style={styles.tdMitjana}>
                            <span style={{ color: colorNota(m), fontWeight: 500 }}>{m !== null ? m.toFixed(2) : "—"}</span>
                          </td>
                        );
                      })}
                      <td style={styles.tdResultat}>
                        <span style={{ color: colorNota(nAval), fontWeight: 600 }}>{nAval !== null ? nAval.toFixed(2) : "—"}</span>
                      </td>
                      <td style={{ ...styles.tdResultat, background: nAcu !== null ? escalaColor(nAcu) : "transparent" }}>
                        <span style={{ fontWeight: 700, color: "#831843" }}>{nAcu !== null ? nAcu.toFixed(2) : "—"}</span>
                      </td>
                      <td style={styles.tdAccions}>
                        <button style={styles.btnEliminar} onClick={() => eliminarAlumne(a.id)} title="Eliminar alumne" aria-label="Eliminar alumne">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.peu}>
            <button style={styles.btnAfegirAlumne} onClick={afegirAlumne}>+ Afegir alumne</button>
            <button style={styles.btnImportar} onClick={() => { setImportObert(true); setTextImport(""); setModeImport("afegir"); }}>Importar alumnat</button>
            <p style={styles.nota}>
              Avaluació contínua: mitjana de les notes de totes les avaluacions fetes fins ara. Pesos: 40% exàmens · 40% pràctica · 20% actitud. Les cel·les buides no penalitzen. Pots afegir o llevar columnes als blocs d'exàmens i pràctica amb els botons + i ×; cada grup té les seues columnes pròpies i independents.
            </p>
          </div>
        </>
      )}

      {importObert && (
        <div style={styles.modalFons} onClick={() => setImportObert(false)}>
          <div style={{ ...styles.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.importTitol}>Importar alumnat a «{curs.nom}»</h2>
            <p style={styles.importAjuda}>
              Al teu full de càlcul, selecciona les tres columnes (Cognom 1, Cognom 2, Nom) amb les files
              de l'alumnat, còpia-les (Ctrl+C) i enganxa-les ací baix (Ctrl+V). Cada fila serà un alumne.
            </p>
            <textarea
              style={styles.importArea}
              value={textImport}
              onChange={(e) => setTextImport(e.target.value)}
              placeholder={"Enganxa ací. Exemple:\nGarcia\tLópez\tMaria\nSanchis\tMoll\tPau"}
              autoFocus
            />
            <div style={styles.importOpcions}>
              <label style={styles.importRadio}>
                <input type="radio" name="modeImport" checked={modeImport === "afegir"} onChange={() => setModeImport("afegir")} />
                <span>Afegir als que ja hi ha</span>
              </label>
              <label style={styles.importRadio}>
                <input type="radio" name="modeImport" checked={modeImport === "reemplacar"} onChange={() => setModeImport("reemplacar")} />
                <span>Reemplaçar tot l'alumnat del grup</span>
              </label>
            </div>
            {textImport.trim() && (
              <p style={styles.importPreview}>
                Es detecten <strong>{previsualitzaImport().length}</strong> alumnes.
              </p>
            )}
            <div style={styles.modalBotons}>
              <button style={styles.btnCancelar} onClick={() => setImportObert(false)}>Cancel·lar</button>
              <button
                style={{ ...styles.btnConfirmar, background: "#2563EB", opacity: previsualitzaImport().length ? 1 : 0.5 }}
                onClick={confirmaImport}
                disabled={!previsualitzaImport().length}
              >
                Importar {previsualitzaImport().length || ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacio && (
        <div style={styles.modalFons} onClick={() => setConfirmacio(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p style={styles.modalText}>{confirmacio.missatge}</p>
            <div style={styles.modalBotons}>
              {confirmacio.nomesInfo ? (
                <button style={styles.btnConfirmar} onClick={() => setConfirmacio(null)}>Entesos</button>
              ) : (
                <>
                  <button style={styles.btnCancelar} onClick={() => setConfirmacio(null)}>Cancel·lar</button>
                  <button style={styles.btnConfirmar} onClick={() => { confirmacio.accio(); setConfirmacio(null); }}>Eliminar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ etiqueta, valor, color }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statEtiqueta}>{etiqueta}</span>
      <span style={{ ...styles.statValor, ...(color ? { color } : {}) }}>{valor}</span>
    </div>
  );
}

const cssGlobal = `
  * { box-sizing: border-box; }
  input:focus { outline: 2px solid #2563EB33; outline-offset: -1px; }
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
`;

const styles = {
  page: { fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F8FB", minHeight: "100vh", color: "#1E293B" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "#0F172A", color: "#fff" },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  logo: { width: 40, height: 40, borderRadius: 10, background: "#DB2777", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" },
  title: { fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  subtitle: { fontSize: 12.5, margin: 0, color: "#94A3B8" },
  headerActions: { display: "flex", gap: 10 },
  btnPrimary: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#DB2777", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "9px 18px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#E2E8F0", fontWeight: 500, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" },
  cursosBar: { display: "flex", alignItems: "center", gap: 6, padding: "12px 24px 0", background: "#0F172A", flexWrap: "wrap" },
  cursTab: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: "8px 8px 0 0", background: "#1E293B", color: "#94A3B8", cursor: "pointer", fontSize: 13.5, fontWeight: 500 },
  cursTabActiu: { background: "#F7F8FB", color: "#0F172A", fontWeight: 600 },
  cursTancar: { border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 17, lineHeight: 1, padding: 0, opacity: 0.6 },
  cursAfegir: { padding: "9px 14px", border: "1px dashed #475569", background: "transparent", color: "#94A3B8", borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: 13.5, fontFamily: "inherit" },
  cursAfegirForm: { display: "flex", gap: 6, alignItems: "center", padding: "4px 0" },
  cursInput: { padding: "7px 10px", borderRadius: 6, border: "1px solid #475569", background: "#1E293B", color: "#fff", fontSize: 13.5, width: 140, fontFamily: "inherit" },
  btnMini: { padding: "7px 12px", borderRadius: 6, border: "none", background: "#DB2777", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  errorBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 24px 0", padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 },
  errorTancar: { border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 },
  estatBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 24px", background: "#EEF2F7", color: "#475569", fontSize: 12.5, borderBottom: "1px solid #E2E8F0" },
  pendent: { color: "#B45309", fontWeight: 600 },
  subBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", flexWrap: "wrap", gap: 16 },
  avalTabs: { display: "flex", gap: 4, background: "#EAECF2", padding: 4, borderRadius: 10 },
  avalTab: { padding: "8px 16px", borderRadius: 7, border: "none", background: "transparent", color: "#64748B", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  avalTabActiu: { background: "#fff", color: "#0F172A", fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  stats: { display: "flex", gap: 22 },
  stat: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  statEtiqueta: { fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" },
  statValor: { fontSize: 19, fontWeight: 600, fontFamily: "'Fraunces', serif" },
  taulaWrap: { overflowX: "auto", margin: "0 24px", borderRadius: 12, border: "1px solid #E2E8F0", background: "#fff" },
  taula: { borderCollapse: "separate", borderSpacing: 0, width: "100%", fontSize: 13 },
  thAlumnat: { background: "#334155", color: "#fff", padding: "8px 12px", textAlign: "center", fontWeight: 600, fontSize: 12 },
  thBloc: { color: "#fff", padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 12, borderLeft: "1px solid rgba(255,255,255,0.15)" },
  thAccions: { background: "#334155", width: 36 },
  thSub: { padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 11, background: "#F1F5F9", color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" },
  thCriteriWrap: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  colTancar: { border: "none", background: "transparent", color: "#CBD5E1", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 },
  colAfegir: { border: "1px solid", background: "transparent", borderRadius: 5, cursor: "pointer", fontSize: 15, lineHeight: 1, width: 22, height: 22, fontWeight: 600 },
  colAfegirForm: { display: "flex", gap: 3, alignItems: "center" },
  colInput: { padding: "5px 6px", borderRadius: 5, border: "1px solid #CBD5E1", fontSize: 12, width: 80, fontFamily: "inherit" },
  colAfegirBtn: { border: "none", color: "#fff", borderRadius: 5, cursor: "pointer", fontSize: 12, padding: "5px 8px", fontWeight: 600 },
  stickyCol1: { position: "sticky", left: 0, zIndex: 2, minWidth: 90 },
  stickyCol2: { position: "sticky", left: 90, zIndex: 2, minWidth: 90 },
  stickyCol3: { position: "sticky", left: 180, zIndex: 2, minWidth: 80 },
  stickyNormal: { background: "#fff" },
  stickyAlt: { background: "#F8FAFC" },
  trAlt: { background: "#F8FAFC" },
  tdNom: { padding: 0, borderBottom: "1px solid #F1F5F9" },
  inputNom: { width: "100%", border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#1E293B", fontFamily: "inherit" },
  tdNota: { padding: 0, borderBottom: "1px solid #F1F5F9", borderLeft: "1px solid #F1F5F9" },
  tdBuit: { padding: 0, borderBottom: "1px solid #F1F5F9", background: "#FBFCFE" },
  inputNota: { width: 52, border: "none", textAlign: "center", padding: "7px 4px", fontSize: 13, fontFamily: "inherit" },
  tdMitjana: { padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F1F5F9", borderLeft: "1px solid #E2E8F0", fontSize: 13, minWidth: 64, background: "#FAFBFC" },
  tdResultat: { padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F1F5F9", borderLeft: "1px solid #E2E8F0", fontSize: 13.5, minWidth: 70 },
  tdAccions: { textAlign: "center", borderBottom: "1px solid #F1F5F9" },
  btnEliminar: { border: "none", background: "transparent", color: "#CBD5E1", cursor: "pointer", fontSize: 17, lineHeight: 1, padding: "2px 6px" },
  peu: { padding: "18px 24px 40px" },
  btnAfegirAlumne: { padding: "10px 18px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#334155", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  btnImportar: { padding: "10px 18px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginLeft: 10 },
  importTitol: { fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: "#1E293B" },
  importAjuda: { fontSize: 13, color: "#64748B", margin: "0 0 14px", lineHeight: 1.55 },
  importArea: { width: "100%", minHeight: 140, borderRadius: 8, border: "1px solid #CBD5E1", padding: "10px 12px", fontSize: 13, fontFamily: "monospace", resize: "vertical", color: "#1E293B" },
  importOpcions: { display: "flex", gap: 20, margin: "14px 0 4px", flexWrap: "wrap" },
  importRadio: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#334155", cursor: "pointer" },
  importPreview: { fontSize: 13, color: "#059669", margin: "10px 0 0" },
  nota: { fontSize: 12, color: "#94A3B8", marginTop: 14, maxWidth: 760, lineHeight: 1.6 },
  buit: { padding: "60px 24px", textAlign: "center", color: "#94A3B8" },
  modalFons: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: "24px 24px 20px", maxWidth: 400, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  modalText: { fontSize: 14.5, color: "#1E293B", margin: "0 0 20px", lineHeight: 1.55 },
  modalBotons: { display: "flex", gap: 10, justifyContent: "flex-end" },
  btnCancelar: { padding: "9px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#475569", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  btnConfirmar: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

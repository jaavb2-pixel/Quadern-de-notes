// ============================================================
//  Exportació de reunions amb famílies a Excel (.xlsx)
// ============================================================
import * as XLSX from "xlsx";

const ETIQUETA_TIPUS = { presencial: "Presencial", telefonica: "Telefònica" };
const ETIQUETA_MOTIU = {
  academic: "Seguiment acadèmic",
  comportament: "Comportament",
  absentisme: "Absentisme",
  orientacio: "Orientació",
  altres: "Altres",
};
const ETIQUETA_ASSISTENTS = {
  mare: "Mare", pare: "Pare", tutor: "Tutor/a legal",
  ambdos: "Ambdós progenitors", altres: "Altres",
};

function nomComplet(a) {
  return [a.cognom1, a.cognom2, a.nom].filter(Boolean).join(" ").trim() || "(sense nom)";
}

// Construeix les files per a una llista d'alumnes (amb el nom del grup a cada fila)
function filesDeReunions(alumnes, nomGrup) {
  const files = [];
  for (const a of alumnes) {
    const reunions = a.reunions || [];
    for (const r of reunions) {
      files.push({
        Grup: nomGrup,
        Alumne: nomComplet(a),
        Data: r.data || "",
        Tipus: ETIQUETA_TIPUS[r.tipus] || r.tipus || "",
        Motiu: ETIQUETA_MOTIU[r.motiu] || r.motiu || "",
        Assistents: ETIQUETA_ASSISTENTS[r.assistents] || r.assistents || "",
        Descripció: r.text || "",
      });
    }
  }
  // Ordena per data (les buides al final)
  files.sort((x, y) => {
    if (!x.Data) return 1;
    if (!y.Data) return -1;
    return x.Data.localeCompare(y.Data);
  });
  return files;
}

function generaFull(files) {
  const capceleres = ["Grup", "Alumne", "Data", "Tipus", "Motiu", "Assistents", "Descripció"];
  const ws = XLSX.utils.json_to_sheet(files, { header: capceleres });
  // Amplades de columna
  ws["!cols"] = [
    { wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 60 },
  ];
  return ws;
}

function descarrega(wb, nomFitxer) {
  XLSX.writeFile(wb, nomFitxer);
}

// Exporta les reunions d'un sol alumne
export function exportaAlumne(alumne, nomGrup) {
  const files = filesDeReunions([alumne], nomGrup);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, generaFull(files), "Reunions");
  const nom = [alumne.cognom1, alumne.cognom2, alumne.nom].filter(Boolean).join("_") || "alumne";
  descarrega(wb, `reunions_${nom}.xlsx`);
}

// Exporta totes les reunions d'un grup
export function exportaGrup(curs) {
  const files = filesDeReunions(curs.alumnes, curs.nom);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, generaFull(files), "Reunions");
  descarrega(wb, `reunions_${curs.nom.replace(/\s+/g, "_")}.xlsx`);
}

import {
  cleanDraft,
  validateDraft,
  type Family,
  type FamilyDraft,
} from "./domain";
import { supabase } from "./supabase";

function db() {
  if (!supabase)
    throw new Error("A conexão com o banco ainda não foi configurada.");
  return supabase;
}

export async function listFamilies(): Promise<Family[]> {
  const pageSize = 1000;
  const rows: Family[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db()
      .from("familias")
      .select("*")
      .order("criado_em", { ascending: false })
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error)
      throw new Error(
        "Não foi possível carregar os cadastros. Confira a conexão e suas permissões.",
      );
    rows.push(...(data as Family[]));
    if (data.length < pageSize) return rows;
  }
}

export async function saveFamily(
  draft: FamilyDraft,
  previous?: Family,
): Promise<Family> {
  const validation = validateDraft(draft);
  if (validation) throw new Error(validation);
  const payload = cleanDraft(draft);
  const query = previous
    ? db()
        .from("familias")
        .update(payload)
        .eq("id", previous.id)
        .eq("versao", previous.versao)
    : db().from("familias").insert(payload);
  const { data, error } = await query.select("*").maybeSingle();
  if (error)
    throw new Error(
      "O cadastro não foi salvo. Confira a conexão e sua permissão para editar esta família.",
    );
  if (!data)
    throw new Error(
      "Este cadastro mudou ou você não tem permissão para editá-lo. Atualize a lista antes de tentar novamente.",
    );
  return data as Family;
}

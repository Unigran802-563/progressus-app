"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Testando conexão...");

  useEffect(() => {
    async function testConnection() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("projeto")
        .select("id_projeto, nome")
        .limit(1);

      if (error) {
        setStatus(`Erro: ${error.message}`);
        return;
      }

      setStatus(
        `Supabase conectado! Projetos encontrados: ${data?.length ?? 0} ✅`,
      );
    }

    testConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <h1 className="text-xl font-semibold">{status}</h1>
    </main>
  );
}
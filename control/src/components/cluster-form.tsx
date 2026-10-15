import type { Cluster } from "@prisma/client";
import { SECRET_FIELDS, type ClusterSecrets } from "@/lib/cluster-config";
import { Card, Field } from "./ui";

// Shared by "new cluster" and "edit cluster".
export function ClusterFields({ cluster, secrets, platformKey }: { cluster?: Cluster; secrets: ClusterSecrets | null; platformKey?: string }) {
  return (
    <>
      <Card title="Cluster">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" hint="e.g. cluster-1"><input name="name" required defaultValue={cluster?.name} /></Field>
          <Field label="App address (Vercel)" hint="https://….vercel.app"><input name="appUrl" required type="url" defaultValue={cluster?.appUrl} placeholder="https://gym-cluster-1.vercel.app" /></Field>
          <Field label="Gyms it can hold"><input name="capacity" type="number" min={1} max={100} required defaultValue={cluster?.capacity ?? 5} /></Field>
          <Field label="WhatsApp sender address (Render)" hint="https://….onrender.com"><input name="senderUrl" type="url" defaultValue={cluster?.senderUrl ?? ""} /></Field>
          <Field label="PLATFORM_API_KEY" hint={cluster ? "Leave empty to keep the current key." : "Put the same value on the cluster's Vercel project."}>
            <input name="platformKey" defaultValue={platformKey} minLength={24} required={!cluster} placeholder={cluster ? "unchanged" : ""} />
          </Field>
        </div>
      </Card>
      <Card title="Accounts" description="Which free accounts this cluster runs on. Keep the passwords in your password manager, not here.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vercel account (email)"><input name="vercelAccount" defaultValue={cluster?.vercelAccount ?? ""} /></Field>
          <Field label="Render account (email)"><input name="renderAccount" defaultValue={cluster?.renderAccount ?? ""} /></Field>
          <Field label="Supabase account (email)"><input name="supabaseAccount" defaultValue={cluster?.supabaseAccount ?? ""} /></Field>
          <Field label="Supabase project" hint="Project name or reference"><input name="supabaseProject" defaultValue={cluster?.supabaseProject ?? ""} /></Field>
        </div>
        <div className="mt-4"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={cluster?.notes ?? ""} /></Field></div>
      </Card>
      <Card title="Settings of this cluster" description="Stored encrypted. These are what you paste into Vercel and Render.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SECRET_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}><input name={f.key} defaultValue={secrets?.[f.key] ?? ""} autoComplete="off" spellCheck={false} /></Field>
          ))}
        </div>
      </Card>
    </>
  );
}

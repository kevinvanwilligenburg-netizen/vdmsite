import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getPage } from "@/lib/content";

// Inhoud komt uit KV en wordt beheerd via het VDM-dashboard; altijd vers renderen.
export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description ?? undefined,
    alternates: { canonical: `/info/${page.slug}` },
  };
}

/** Eenvoudige weergave: lege regel = alinea, regel met "## " = tussenkop. */
function renderBody(body: string) {
  return body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      if (block.startsWith("## ")) {
        return (
          <h2 key={index} className="mt-8 text-xl font-black text-ink">
            {block.slice(3)}
          </h2>
        );
      }
      return (
        <p key={index} className="mt-4 leading-relaxed text-ink-soft">
          {block}
        </p>
      );
    });
}

export default async function InfoPage({ params }: Props) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: page.title }]} />
      <h1 className="mt-6 text-3xl font-black uppercase text-ink sm:text-4xl">
        {page.title}
      </h1>
      {page.description && (
        <p className="mt-3 text-lg font-semibold text-ink-soft">{page.description}</p>
      )}
      <div className="card mt-6 p-6 sm:p-8">{renderBody(page.body)}</div>
    </article>
  );
}

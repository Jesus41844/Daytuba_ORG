import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getUserCategories } from "@/features/categories/queries";
import { CategoryManager } from "@/features/categories/components/category-manager";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Categorías | Daytuba Tasks",
};

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const categories = await getUserCategories();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Categorías"
        description="Crea y gestiona las categorías para organizar tus tareas."
      />
      <CategoryManager categories={categories} />
    </div>
  );
}

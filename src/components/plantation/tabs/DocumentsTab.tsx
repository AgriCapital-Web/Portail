import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../EmptyState";
import { FileText, Download } from "lucide-react";

export const DocumentsTab = ({ plantation, client }: { plantation: any; client: any }) => {
  const docs: any[] = [
    ...(Array.isArray(client?.documents) ? client.documents : []),
    ...(Array.isArray(plantation?.documents) ? plantation.documents : []),
  ];
  if (docs.length === 0) {
    return <EmptyState icon={FileText} title="Aucun document disponible" description="Votre contrat, les annexes, plans topographiques et plans de plantation apparaîtront ici dès leur mise en ligne." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {docs.map((d, i) => (
        <Card key={d?.id || i} className="rounded-2xl h-full">
          <CardContent className="p-4 h-full flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold break-words">{d?.nom || d?.type_document || "Document"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{d?.categorie || d?.type || ""}</p>
              </div>
            </div>
            {d?.url && (
              <Button asChild size="sm" variant="outline" className="h-8 mt-auto w-full">
                <a href={d.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1" /> Ouvrir le document</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

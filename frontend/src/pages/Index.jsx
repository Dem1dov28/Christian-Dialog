import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { SEO } from "@/components/common/SEO";

const Index = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Общайтесь с историческими личностями через AI"
        description="Epochal Dialog — уникальная платформа для диалогов с AI-агентами исторических личностей. Общайтесь с Эйнштейном, Наполеоном, Толстым и другими великими личностями."
        keywords="Epochal Dialog, AI чат, исторические личности, диалоги с Эйнштейном, искусственный интеллект, исторические фигуры"
        canonical="/welcome"
        ogImage="https://epochaldialog.com/og-image.webp"
      />
      <main className="flex min-h-dscreen items-center justify-center relative">
        <AuthBackground />
        <section className="relative z-10 text-center backdrop-blur-xl bg-card/40 border border-white/10 rounded-3xl p-12 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_-2px_16px_rgba(255,255,255,0.05)] max-w-lg w-full mx-4">
          <h1 className="mb-4 text-5xl font-bold text-foreground">Добро пожаловать в Epochal Dialog</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Общайтесь с великими историческими личностями через искусственный интеллект
          </p>
          <Button
            onClick={() => navigate("/login")}
            variant="neomorphic"
            size="lg"
            aria-label="Перейти к входу в систему"
          >
            Начать диалог
          </Button>
        </section>
      </main>
    </>
  );
};

export default Index;

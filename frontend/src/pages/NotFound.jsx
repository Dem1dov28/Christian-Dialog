import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SEO } from "@/components/common/SEO";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEO
        title="404 - Страница не найдена"
        noindex={true}
      />
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <section className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">404</h1>
          <p className="text-xl text-muted-foreground mb-8">Страница не найдена</p>
          <Button onClick={() => navigate("/")}>
            Вернуться на главную
          </Button>
        </section>
      </main>
    </>
  );
};

export default NotFound;

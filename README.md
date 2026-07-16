# ArchivEO

Logiciel d'archivage électronique développé pour le **Projet National de Développement Agricole (PNDA)** — République Démocratique du Congo.

## Stack technique

- React 18 + Vite 5
- Tailwind CSS v4
- Framer Motion
- Supabase (authentification, base de données, stockage)

## Démarrage

```bash
npm install
npm run dev
```

## Pont de scan local

Le scan direct et la détection d'imprimantes/scanners nécessitent le pont local :

```bash
npm run scan-bridge
```


If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

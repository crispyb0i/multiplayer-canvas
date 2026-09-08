import Editor from "./editor";

export default function Home() {
  return (
    <main className="mx-auto max-w-[980px] px-8 py-[8vh]">
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-accent">M2 · Single-user editor</p>
      <h1 className="my-4 text-[clamp(3rem,8vw,6rem)] tracking-[-0.06em]">Multiplayer Canvas</h1>
      <p className="max-w-[38rem] text-xl leading-relaxed text-muted">
        A learning-first foundation for a real-time collaborative technical diagramming app.
      </p>
      <Editor />
    </main>
  );
}

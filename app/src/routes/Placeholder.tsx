/* A part of the campaign flavour that arrives with the server. */
import ui from '../ui/ui.module.css';

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className={ui.page}>
      <h1>{title}</h1>
      <p className={ui.muted}>{text}</p>
    </section>
  );
}

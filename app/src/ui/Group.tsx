/* A titled group of entries (#86): the heading and its entries are one block – a frame with a rail and a title bar – so
   it is clear which warbands belong to which heading, with room above the block rather than between title and entries. */
import type { ReactNode } from 'react';
import ui from './ui.module.css';

export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={ui.group} aria-labelledby={id}>
      <h2 id={id} className={ui.groupTitle}>{title}</h2>
      {children}
    </section>
  );
}

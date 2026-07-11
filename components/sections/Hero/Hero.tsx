import { HeroStats } from '@/components/HeroStats';
import { heroTagline } from '@/content/hero';
import { Badge, Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';

export function Hero() {
  return (
    <>
      <section
        id="bio"
        className="hero-desktop relative border border-primary-subtle min-h-[640px] overflow-hidden mb-10 md:mb-[40px] bg-transparent transition-transform duration-100 ease-out motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none"
        data-testid="hero-desktop"
      >
        <div className="flex-1 relative overflow-hidden">
          <HeroBootAnimation variant="desktop" />
        </div>
        <aside className="hero-bio flex-1 border-l border-dashed border-primary-subtle flex flex-col justify-end px-6 py-8 gap-[10px]">
          <h1
            className="font-mono font-bold text-[32px] md:text-[48px] text-primary-500 m-0 mb-1 leading-[1.2]"
            data-testid="hero-name"
          >
            Erik Cunha
          </h1>
          <p className="text-tertiary-50 text-sm leading-[1.55] mb-2">{heroTagline}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-primary-400 text-sm tracking-[0.08em] mb-3.5">
            <span>
              LOC:{' '}
              <b className="bg-primary-500 text-black font-bold px-1.5 border border-transparent transition-colors motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none hover:bg-transparent hover:text-primary-500 hover:border-primary-500">
                Brazil
              </b>
            </span>
            <span>
              NOW: <b className="text-primary-500 font-bold">Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <div className="self-start">
            <Badge variant="dot">OPEN_TO_RELOCATION · WORLDWIDE</Badge>
          </div>
          <HeroStats />
          <div className="grid grid-cols-2 gap-3 mt-3 [text-shadow:none]" data-testid="hero-ctas">
            <Button
              as="a"
              variant="primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </Button>
            <Button
              as="a"
              variant="secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </Button>
          </div>
        </aside>
        <HeroSystemFailure />
      </section>

      <section
        className="hero-mobile relative border border-primary-subtle overflow-hidden mb-10 bg-transparent mt-2"
        data-testid="hero-mobile"
      >
        <div className="relative z-[1] p-4 pb-[18px]">
          <HeroBootAnimation variant="mobile" />

          <h1
            className="font-mono font-bold text-[24px] text-primary-500 border-t border-dashed border-primary-quiet pt-3.5 mt-1.5 mb-0.5 leading-[1.55]"
            data-testid="hero-name"
          >
            Erik Cunha
          </h1>
          <p className="text-tertiary-50 text-xs leading-[1.55] mb-2">{heroTagline}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-primary-400 text-xs tracking-[0.08em] mb-3.5">
            <span>
              LOC:{' '}
              <b className="bg-primary-500 text-black font-bold px-1.5 border border-transparent transition-colors motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none hover:bg-transparent hover:text-primary-500 hover:border-primary-500">
                Brazil
              </b>
            </span>
            <span>
              NOW: <b className="text-primary-500 font-bold">Betsson</b>
            </span>
            <span>EN/PT/FR/ES</span>
          </p>
          <div className="self-start mb-3.5">
            <Badge variant="dot">OPEN_TO_RELOCATION · WORLDWIDE</Badge>
          </div>
          <HeroStats />
          <div className="grid grid-cols-2 gap-3 mt-3 [text-shadow:none]" data-testid="hero-ctas">
            <Button
              as="a"
              variant="primary"
              href="https://www.linkedin.com/in/erikunha/"
              target="_blank"
              rel="noreferrer"
            >
              EXEC HIRE
            </Button>
            <Button
              as="a"
              variant="secondary"
              href="https://github.com/erikunha"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB ↗
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

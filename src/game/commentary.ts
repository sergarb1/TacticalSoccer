/**
 * Narración del partido estilo «comentarista desde la terraza»: frases
 * cortas para eventos y frases ambientales según el estado. Cosmético y
 * no determinista (usa Math.random), pero NUNCA toca la lógica del motor.
 */
import type { GameEvent, GameState, Player } from './types';

export interface Line {
  id: number;
  text: string;
  kind: 'event' | 'ambient';
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function nameOf(s: GameState, id: number | undefined): string {
  if (id === undefined) return 'un futbolista';
  return s.players.find((p) => p.id === id)?.name ?? 'un futbolista';
}

const sideOf = (t: 0 | 1): string => (t === 0 ? 'los rojos' : 'los azules');

/** Frase de comentarista para un evento del motor (null si no aplica). */
export function commentaryForEvent(s: GameState, e: GameEvent): string | null {
  switch (e.type) {
    case 'goal': {
      return pick([
        '¡GOOOOOOL! ¡El Turia se sale de su cauce!',
        '¡GOL! ¡Y Mestalla se cae de la silla!',
        '¡GOOOOL! ¡Por las medias naranjas, qué manera de ponerla!',
        '¡GOLAZO! ¡Se puede chutar así de intentado, ché!'
      ]);
    }
    case 'shot': {
      const shooter = nameOf(s, e.shooterId);
      if (e.outcome === 'save') {
        return pick([
          '¡Paradón del portero! ¡Qué manoplas, ché!',
          '¡La saca con la punta de los dedos!',
          'Dispara ' + shooter + '… ¡y el portero vuela!',
          '¡Diosío! ¡Manos mágicas de portero!'
        ]);
      }
      if (e.outcome === 'off') {
        return pick([
          'Dispara ' + shooter + '… ¡fuera! ¡Al río el balón!',
          '¡Uy, uy… se va fuera, como un misil perdido!',
          '¡Disparo de ' + shooter + '… a las gradas!'
        ]);
      }
      if (e.outcome === 'block') {
        return pick([
          '¡Bloqueado! La defensa pone el carro delante…',
          '¡Se la estampan en un rival! ¡Qué manera de poner el cuerpo!'
        ]);
      }
      if (e.outcome === 'rebound') return pick(['¡Rebote peligroso! ¡Pelota caliente en el área!']);
      return '¡' + shooter + ' remata!…';
    }
    case 'pass': {
      if (e.success) {
        return pick([
          'El pase va limpito, limpito… teje y maneje.',
          '¡Pase de tiralíneas!',
          'Balón que va de un lado a otro con elegancia.'
        ]);
      }
      return pick(['¡Pase cortado… o al patín! Balón suelto.', '¡Ups! El pase no llega a buen puerto.']);
    }
    case 'steal': {
      const d = nameOf(s, e.defenderId);
      return e.success
        ? pick(['¡Roba ' + d + '! ¡Garra ché de la buena!', '¡Ladrón de guante blanco: ' + d + '!'])
        : pick(['Va a por ella ' + d + '… pero se escapa.', 'Intento de robo de ' + d + ', sin premio.']);
    }
    case 'pickup': {
      const p = nameOf(s, e.playerId);
      return pick([p + ' doma el balón suelto.', '¡Cae sobre la pelota ' + p + ' y la endereza!']);
    }
    case 'turn': {
      const t = (e as { team?: 0 | 1 }).team;
      if (t === undefined) return null;
      return pick(['La pelota rueda y juegan ' + sideOf(t) + '.', 'Manos a la obra, ' + sideOf(t) + '.']);
    }
    case 'halftime': {
      return pick([
        '¡Descanso! El público va a por el fresquito.',
        'Se va la primera parte… 15 minutos de espíritu ché.'
      ]);
    }
    case 'fulltime': {
      return pick([
        '¡FIN DEL PARTIDO! Banderita verde… y a tomar el bocadillo.',
        '¡Suelta el guante, árbitro! Se acabó lo que se daba.'
      ]);
    }
    default:
      return null;
  }
}

/** Frase ambiental según el estado (para los silencios del narrador). */
export function ambientLine(s: GameState): string {
  const min = Math.min(90, s.teamTurns * 3);
  const score = `${s.score[0]}–${s.score[1]}`;
  if (s.phase === 'fulltime') return `El marcador final: ${score}.`;
  const carrier: Player | undefined = s.ball.carrier === null ? undefined : s.players.find((p) => p.id === s.ball.carrier);
  if (carrier) {
    void nameOf;
    return pick([
      `${carrier.name} lleva la pelota pegada a la bota…`,
      `Minuto ${min}, ${score}: la movida está en las botas de ${carrier.name}.`,
      `El balón quiere ir rápido y ${carrier.name} no tiene prisa.`
    ]);
  }
  return pick([
    `Balón suelto… ¡a ver quién es el más gañán!`,
    `Minuto ${min}, ${score}: la pelota rueda sin dueño.`,
    `El balón duerme en el césped; alguien lo querrá despertar.`
  ]);
}

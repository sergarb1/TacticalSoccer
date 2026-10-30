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

/** Líneas para el Tiro Billetes (el cañonazo con sello). */
const BILLETES = {
  launch: [
    '¡Saca la cartera… TIRO BILLETES! ¡Esto va con sello y factura!',
    '¡TIRO BILLETEEEES! ¡Cañonazo de la casa: feo de mirar y divino de oír!',
    '¡Se gasta los billetes en el disparo! ¡Qué manera de jugársela, ché!'
  ],
  goal: [
    '¡GOOOOOOL DE BILLETES! ¡El Turia se sale de su cauce… y el banco también!',
    '¡GOLAZO, GOLAZO BILLETES! ¡Y esto se cobra con intereses, ché!',
    '¡Y la factura del cañonazo la cobran EN PORTERÍA! ¡Qué dineral de gol!'
  ],
  off: [
    '¡Billetes al río! Disparo divino… a la tercera fila.',
    'El tiro billetes se fue a la grada: bonito despilfarro, ché.'
  ],
  save: [
    '¡Tiro billetes… y el portero ejecuta! ¡Parada de cuenta sabrosa!',
    'La parada más cara del partido: el meta salva el presupuesto y la tarde.'
  ],
  block: [
    '¡Billetes rechazados! La defensa cierra la ventanilla.'
  ]
};

/** Líneas para la Vaselina (el toque angelado). */
const VASELINA = {
  launch: [
    '¡VASSELINA! ¡Y con muchísimo mimo, que se puede dar por descontado!',
    '¡Uy, uy... quiso la vaselina desde aquí!',
    '¡VASELINA! El toque angelado del que sabe tomar café.'
  ],
  goal: [
    '¡GOOOOOOL POR VASELINA! ¡El portero mira volar el balón… y no llega!',
    '¡GOL! ¡Vaselina con receta de abuela! ¡Se pone el estadio en pie!',
    '¡La cocina le salió al delantero: GOL con la vaselina del año!'
  ],
  off: [
    'La vaselina se le fue al techo… ¡era más grito que pelota!',
    '¡Vaselina sin gas… la pelota cae como bizcocho flojo!'
  ],
  save: [
    'La vaselina llegó bonita, pero el portero tomó café frío… ¡Y LA RETIENE!',
    '¡Vaselina, palomita… y se queda el portero con ella!'
  ],
  block: [
    'La vaselina pegó en un cráneo rival: ¡se acabó el postre!'
  ]
};

/** Frase de comentarista para un evento del motor (null si no aplica). */
export function commentaryForEvent(s: GameState, e: GameEvent): string | null {
  switch (e.type) {
    case 'goal': {
      return pick([
        '¡GOOOOOOL! ¡El Turia se sale de su cauce!',
        '¡GOL! ¡Y Mestalla se cae de la silla!',
        '¡GOOOOL! ¡Por las medias naranjas, qué manera de ponerla!',
        '¡GOLAZO! ¡Se puede marcar así de intentado, ché!'
      ]);
    }
    case 'shot': {
      const shooter = nameOf(s, e.shooterId);
      const kind = e.kind;
      const pack = kind === 'billetes' ? BILLETES : kind === 'vaselina' ? VASELINA : null;
      if (pack) {
        const key: 'goal' | 'save' | 'block' | 'off' =
          e.outcome === 'goal' ? 'goal' : e.outcome === 'save' ? 'save' : e.outcome === 'block' ? 'block' : 'off';
        return pick(pack[key]);
      }
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
      if (e.hachazo) {
        return e.success
          ? pick([
              '¡HACHAZO! ¡' + d + ' ha metido el machete con gracia y el balón es suyo!',
              '¡Menudo hachazo de ' + d + '! ¡Robo con matrícula de honor!',
              '¡Hachazo de premium: ' + d + ' cobra y punto, ché!'
            ])
          : pick([
              'Hachazo de ' + d + '… ¡y se le escapa el balón como billete al viento!',
              '¡El hachazo de ' + d + ' no llega: la víctima sale volando con la pelota!'
            ]);
      }
      return e.success
        ? pick(['¡Roba ' + d + '! ¡Garra ché de la buena!', '¡Ladrón de guante blanco: ' + d + '!'])
        : pick(['Va a por ella ' + d + '… pero se escapa.', 'Intento de robo de ' + d + ', sin premio.']);
    }
    case 'meter': {
      if (!('full' in e) || !e.full) return null;
      const t = e.team;
      return pick([
        '¡BARRA LLENA del ' + sideOf(t) + ': acción especial extra en el bolsillo!',
        '¡La barrica está llena, ' + sideOf(t) + '! A desembolsar especiales con gracia.'
      ]);
    }
    case 'cut': {
      const d = nameOf(s, e.defenderId);
      return e.failed
        ? pick([`${d} mira y no llega a plantarse…`, 'La ayuda de ' + d + ' no llega a tiempo.'])
        : pick([
            d + ' se planta al corte: ¡de aquí no pasa la pelota, ni con salmos!',
            '¡Ojo cómo se agranda ' + d + '! Tapa líneas y no la deja pasar.',
            d + ' lee la jugada y se planta: muralla de una finca, ché.'
          ]);
    }
    case 'harden': {
      const t = sideOf(e.team);
      return pick([
                `¡${t} endurecen la defensa! ¡El graderío alza el pulgar, pero el rival cruje los dientes!`,
        '¡Muro de betón atrás! El rival va a tener que mirárselo dos veces.',
        `Defensa garrida de ${t}: ni el despistado pasaría por ahí hoy.`
      ]);
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
  const cutting = s.players.find((p) => p.stance === 'cut');
  // quejas del público cuando el marcador aprieta (o no corre nadie)
  const ahead = s.score[0] - s.score[1];
  if (Math.abs(ahead) >= 2 && Math.random() < 0.4) {
    return ahead > 0
      ? pick([
          `Y los rojos a pasear el partido: ${score} va de calle… el graderío aguantará lo que aguantar pueda.`,
          `Resultadillo ${score} para los rojos: esto pide pitada del personal si lo sueltan más.`
        ])
      : pick([
          `Los azules dominan y remachan (${score}): público impaciente, y poco dispuesto a tragárselo.`,
          `Muy cuesta arriba, ${score} desfavorable: en la grada ya se discute el once del año que viene.`
        ]);
  }
  if (min >= 75 && Math.random() < 0.3) {
    return pick([
      '¡Que corran los años! Falta poco: el graderío cuenta segundos con los dedos.',
      `Minuto ${min}: final apretado… hay más nervios en la grada que en el campo.`
    ]);
  }
  if (cutting && Math.random() < 0.35) {
    return pick([
      `Ojo a ${cutting.name}: se ha plantado al corte y el rival no la pasa por ahí…`,
      `${cutting.name} hace de pared fantasma: tapa líneas con las pataletas.`
    ]);
  }
  if (carrier) {
    return pick([
      `${carrier.name} lleva la pelota pegada a la bota…`,
      `Minuto ${min}, ${score}: la movida está en las botas de ${carrier.name}.`,
      `El balón quiere ir rápido y ${carrier.name} no tiene prisa.`
    ]);
  }
  return pick([
    '¡Balón suelto… a ver quién es el más gañán!',
    `Minuto ${min}, ${score}: la pelota rueda sin dueño.`,
    'El balón duerme en el césped; alguien lo querrá despertar.'
  ]);
}

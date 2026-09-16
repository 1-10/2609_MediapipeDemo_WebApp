/**
 * @import { SemanticPacket } from "../../../../shared/types.js"
 */

/**
 * Converts a semantic packet into display-ready bullet lines.
 *
 * @param {SemanticPacket} semanticPacket
 * @returns {string[]}
 */
export function formatSemanticLines(semanticPacket) {
  if (semanticPacket.objects.length === 0) {
    return [];
  }

  const lines = [];

  for (const object of semanticPacket.objects) {
    lines.push(formatObjectLabel(object.label, object.count));

    if (object.position) {
      lines.push(object.position);
    }

    if (object.size) {
      lines.push(object.size);
    }

    if (object.attributes) {
      lines.push(...object.attributes);
    }
  }

  if (semanticPacket.scene?.environment) {
    lines.push(semanticPacket.scene.environment);
  }

  if (semanticPacket.scene?.layout) {
    lines.push(semanticPacket.scene.layout);
  }

  return lines;
}

/**
 * @param {string} label
 * @param {number | undefined} count
 * @returns {string}
 */
function formatObjectLabel(label, count) {
  return count && count > 1 ? `${label} x${count}` : label;
}

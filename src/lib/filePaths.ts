/**
 * Checks whether two paths identify the same file on the current platform.
 * @param left - First file path.
 * @param right - Second file path.
 * @param platform - Platform identifier used for path case handling.
 * @returns Whether the normalized paths identify the same file.
 */
export function sameFilePath(left: string, right: string, platform: string): boolean {
   const normalizedLeft = left.replace(/\\/g, '/').replace(/\/+$/, '');
   const normalizedRight = right.replace(/\\/g, '/').replace(/\/+$/, '');
   return platform === 'win32'
      ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
      : normalizedLeft === normalizedRight;
}

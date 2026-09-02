/**
 * Utility functions for formatting Storage Space display names and breadcrumbs in presentation components.
 */

/**
 * Formats a Storage Space name for user-facing display.
 * If the name ends with the word "Workspace" (case-insensitive),
 * removes that trailing word and surrounding whitespace.
 *
 * Examples:
 * - "Demo Home Workspace" -> "Demo Home"
 * - "Office Workspace" -> "Office"
 * - "Workspace Storage" -> "Workspace Storage" (unchanged)
 * - "My Workspace Room" -> "My Workspace Room" (unchanged)
 * - "workspace" -> "workspace" (unchanged)
 */
export const getStorageSpaceDisplayName = (name: string): string => {
  if (!name) return name;
  const formatted = name.replace(/\s+Workspace$/i, '').trim();
  return formatted || name;
};

/**
 * Formats a search breadcrumb display string to use formatted Storage Space display names.
 * Only formats the leading Storage Space segment if present; does not alter actual location names.
 *
 * Example:
 * - "Demo Home Workspace → Garage → Rack A → Shelf 1" -> "Demo Home → Garage → Rack A → Shelf 1"
 */
export const formatSearchBreadcrumbDisplay = (breadcrumbDisplay: string, workspaceName: string): string => {
  if (!breadcrumbDisplay || !workspaceName) return breadcrumbDisplay || '';
  const formattedWsName = getStorageSpaceDisplayName(workspaceName);
  if (formattedWsName === workspaceName) return breadcrumbDisplay;

  if (breadcrumbDisplay.startsWith(workspaceName)) {
    return formattedWsName + breadcrumbDisplay.slice(workspaceName.length);
  }
  return breadcrumbDisplay;
};

/**
 * TypeScript interfaces for Modrinth API responses
 * Based on Modrinth API v2/v3 documentation: https://docs.modrinth.com/api/
 */

import type { SideClassification } from '$lib/services/types';
import { classifySide } from '$lib/services/side-classification';

/**
 * API Version types
 */
export type ModrinthAPIVersion = 'v2' | 'v3';

// =============================================================================
// Game Versions & Loaders (Tags)
// =============================================================================

/**
 * Minecraft version information from /tag/game_version
 */
export interface ModrinthGameVersion {
	version: string;
	version_type: 'release' | 'snapshot' | 'alpha' | 'beta';
	date: string;
	major: boolean;
}

/**
 * Mod loader information from /tag/loader
 */
export interface ModrinthLoader {
	icon: string;
	name: string;
	supported_project_types: string[];
}

// =============================================================================
// Collections (v3 API only)
// =============================================================================

/**
 * Collection status options
 */
export type CollectionStatus = 'listed' | 'unlisted' | 'private' | 'rejected';

/**
 * Collection from /collection/{id}
 */
export interface ModrinthCollection {
	id: string;
	user_id: string;
	name: string;
	description?: string;
	icon_url?: string;
	color?: number;
	status: CollectionStatus;
	created: string;
	updated: string;
	projects: string[]; // Array of project IDs
}

// =============================================================================
// Projects (Mods, Resource Packs, etc.)
// =============================================================================

/**
 * Project types
 */
export type ProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'plugin';

/**
 * Side requirement options
 */
export type SideRequirement = 'required' | 'optional' | 'unsupported' | 'unknown';

/**
 * Project status
 */
export type ProjectStatus =
	| 'approved'
	| 'archived'
	| 'rejected'
	| 'draft'
	| 'unlisted'
	| 'processing'
	| 'withheld'
	| 'scheduled'
	| 'private'
	| 'unknown';

/**
 * Project/Mod from /project/{id|slug}
 */
export interface ModrinthProject {
	id: string;
	slug: string;
	project_type: ProjectType;
	team: string;
	title: string;
	description: string;
	body: string;
	body_url?: string;
	published: string;
	updated: string;
	approved?: string;
	queued?: string;
	status: ProjectStatus;
	requested_status?: ProjectStatus;
	moderator_message?: {
		message: string;
		body?: string;
	};
	license: {
		id: string;
		name: string;
		url?: string;
	};
	downloads: number;
	followers: number;
	categories: string[];
	additional_categories?: string[];
	game_versions: string[];
	loaders: string[];
	versions: string[];
	icon_url?: string;
	issues_url?: string;
	source_url?: string;
	wiki_url?: string;
	discord_url?: string;
	donation_urls?: Array<{
		id: string;
		platform: string;
		url: string;
	}>;
	gallery?: Array<{
		url: string;
		featured: boolean;
		title?: string;
		description?: string;
		created: string;
		ordering: number;
	}>;
	color?: number;
	thread_id?: string;
	monetization_status?: 'monetized' | 'demonetized' | 'force-demonetized';

	// Side requirements - important for server/client categorization
	client_side: SideRequirement;
	server_side: SideRequirement;
}

// =============================================================================
// Versions
// =============================================================================

/**
 * Dependency types
 */
export type DependencyType = 'required' | 'optional' | 'incompatible' | 'embedded';

/**
 * Version dependency
 */
export interface ModrinthDependency {
	version_id?: string;
	project_id?: string;
	file_name?: string;
	dependency_type: DependencyType;
}

/**
 * File hash information
 */
export interface ModrinthFileHash {
	sha1: string;
	sha512: string;
}

/**
 * Version file
 */
export interface ModrinthFile {
	hashes: ModrinthFileHash;
	url: string;
	filename: string;
	primary: boolean;
	size: number;
	file_type?: 'required-resource-pack' | 'optional-resource-pack' | null;
}

/**
 * Version status
 */
export type VersionStatus = 'listed' | 'archived' | 'draft' | 'unlisted' | 'scheduled' | 'unknown';

/**
 * Version type (release channel)
 */
export type VersionType = 'release' | 'beta' | 'alpha';

/**
 * Project version from /project/{id}/version or /version/{id}
 */
export interface ModrinthVersion {
	id: string;
	project_id: string;
	author_id: string;
	featured: boolean;
	name: string;
	version_number: string;
	changelog?: string;
	changelog_url?: string;
	date_published: string;
	downloads: number;
	version_type: VersionType;
	status: VersionStatus;
	requested_status?: VersionStatus;
	files: ModrinthFile[];
	dependencies: ModrinthDependency[];
	game_versions: string[];
	loaders: string[];
}

// =============================================================================
// API Response Wrappers
// =============================================================================

/**
 * Response for game versions endpoint
 */
export interface GameVersionsResponse {
	versions: ModrinthGameVersion[];
}

/**
 * Response for loaders endpoint
 */
export interface LoadersResponse {
	loaders: ModrinthLoader[];
}

/**
 * Response for collection endpoint (with projects)
 */
export interface CollectionResponse {
	collection: ModrinthCollection;
	projects: ModrinthProject[];
}

/**
 * Response for project endpoint (with versions)
 */
export interface ProjectResponse {
	project: ModrinthProject;
	versions: ModrinthVersion[];
	compatibleVersion: ModrinthVersion | null;
	isCompatible: boolean;
}

// =============================================================================
// Internal Types (for state management)
// =============================================================================

// Note: MinecraftVersionItem, ModLoaderItem, and ParsedCollection are defined
// in their respective state files (minecraft-versions.svelte.ts, mod-loaders.svelte.ts,
// collections.svelte.ts) to avoid duplication.

/**
 * Parsed project for display
 */
export interface ParsedProject {
	id: string;
	slug: string;
	title: string;
	description: string;
	iconUrl?: string;
	projectType: ProjectType;
	clientSide: SideRequirement;
	serverSide: SideRequirement;
	categories: string[];
	gameVersions: string[];
	loaders: string[];
}

/**
 * Resolved mod for download
 */
export interface ResolvedMod {
	projectId: string;
	projectSlug: string;
	projectName: string;
	projectType: ProjectType;
	versionId: string;
	versionNumber: string;
	fileName: string;
	fileUrl: string;
	fileSize: number;
	clientSide: SideRequirement;
	serverSide: SideRequirement;
	dependencies: ModrinthDependency[];
}

/**
 * Categorization of mod for folder structure
 */
export type ModCategory = SideClassification;

/**
 * Get mod category based on client_side and server_side requirements.
 * Delegates to the shared classifySide function for consistency.
 */
export function getModCategory(
	clientSide: SideRequirement,
	serverSide: SideRequirement
): ModCategory {
	return classifySide(clientSide, serverSide);
}

/**
 * Get target folder based on project type
 */
export function getProjectFolder(projectType: ProjectType): string {
	switch (projectType) {
		case 'mod':
		case 'plugin':
			return 'mods';
		case 'resourcepack':
			return 'resourcepacks';
		case 'shader':
			return 'shaderpacks';
		case 'datapack':
			return 'datapacks';
		case 'modpack':
			return 'modpacks'; // Should be skipped, but handle anyway
		default:
			return 'mods';
	}
}

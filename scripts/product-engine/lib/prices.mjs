/**
 * The tools and their prices, read live on fal.ai on the date below (each model page's
 * "Pricing" paragraph and its Schema). Re-read before a batch: a price here is a record of
 * what the page said that day, not a promise. Every fal page carried the "Commercial use"
 * badge on that date (recorded in docs/world/LICENCES.md).
 */
export const PRICES_READ_ON = '2026-11-08';

/** Image → 3D body. `input` builds the request; `glbUrl` finds the body in the answer. */
export const TOOLS = {
  tripo: {
    key: 'tripo',
    endpoint: 'tripo3d/h3.1/image-to-3d',
    label: 'Tripo H3.1, standard textures + PBR',
    price: 0.3,
    priceNote: '$0.20 no texture · $0.30 standard textures · $0.40 HD; +$0.20 detailed geometry; +$0.05 quad (neither used)',
    input: (imageUrl, seed) => ({
      image_url: imageUrl,
      texture: true,
      pbr: true,
      texture_quality: 'standard',
      geometry_quality: 'standard',
      quad: false,
      // Enough faces for the laptop copy's simplify to keep the silhouette; far less to download than the adaptive default.
      face_limit: 40000,
      // Turn the body to match the photo, so its front is the photo's front.
      orientation: 'align_image',
      auto_size: false,
      texture_alignment: 'original_image',
      ...(seed === undefined ? {} : { model_seed: seed, texture_seed: seed }),
    }),
    glbUrl: (out) => out?.model_urls?.pbr_model?.url ?? out?.model_mesh?.url ?? out?.model_urls?.glb?.url ?? null,
    reroll: 'seed',
  },
  meshy: {
    key: 'meshy',
    endpoint: 'meshy/v7.1/image-to-3d',
    label: 'Meshy 7.1, textured + PBR maps',
    price: 1.2,
    priceNote: '$0.80 base · $1.20 textured; rigging +$0.20; animation +$0.12 per call (people only)',
    input: (imageUrl) => ({
      image_url: imageUrl,
      should_texture: true,
      enable_pbr: true,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: 30000,
      symmetry_mode: 'auto',
    }),
    glbUrl: (out) => out?.model_glb?.url ?? out?.model_urls?.glb?.url ?? null,
    reroll: 'repeat',
  },
  hunyuan: {
    key: 'hunyuan',
    endpoint: 'fal-ai/hunyuan3d-v3/image-to-3d',
    label: 'Hunyuan3D v3, Normal + PBR',
    price: 0.525,
    priceNote: '$0.225 Geometry · $0.375 Normal · $0.45 LowPoly; +$0.15 each for PBR, multi-view, custom face count (PBR used; the face count is left at its default so it adds nothing)',
    input: (imageUrl) => ({
      input_image_url: imageUrl,
      generate_type: 'Normal',
      enable_pbr: true,
    }),
    glbUrl: (out) => out?.model_glb?.url ?? out?.model_urls?.glb?.url ?? null,
    reroll: 'repeat',
  },
};

export const TOOL_KEYS = Object.keys(TOOLS);

/** A person: Meshy rigs the body (walking and running come with the rig) and one animation call adds Idle. */
export const PERSON_TOOL = {
  key: 'meshy-person',
  endpoint: 'meshy/v7.1/image-to-3d',
  label: 'Meshy 7.1 textured + auto-rigging (walk + run) + one animation preset (Idle)',
  price: 1.52,
  priceNote: '$1.20 textured + $0.20 rigging + $0.12 one animation = $1.52 (the page\'s own worked example)',
  input: (imageUrl, heightM) => ({
    image_url: imageUrl,
    should_texture: true,
    enable_pbr: false,
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 20000,
    symmetry_mode: 'auto',
    pose_mode: 'a-pose',
    enable_rigging: true,
    rigging_height_meters: heightM,
    enable_animation: true,
    // 0 is the "Idle" preset in Meshy's library (the Schema says so).
    animation_action_id: 0,
  }),
};

/** The person's picture: a made-up adult, drawn from words only, never from a photo of anyone. */
export const PICTURE_TOOL = {
  key: 'flux-dev',
  endpoint: 'fal-ai/flux/dev',
  label: 'FLUX.1 [dev] text-to-image, portrait 768×1024 (billed per megapixel, rounded up: 1 MP)',
  price: 0.025,
  priceNote: '$0.025 per megapixel, rounded up; portrait_4_3 is 768×1024 = 0.79 MP → 1 MP',
  input: (prompt, seed) => ({
    prompt,
    image_size: 'portrait_4_3',
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'png',
    ...(seed === undefined ? {} : { seed }),
  }),
  imageUrl: (out) => out?.images?.[0]?.url ?? null,
};

export function money(usd) {
  return `$${usd.toFixed(2)}`;
}

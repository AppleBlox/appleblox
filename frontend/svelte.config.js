// import path from "node:path";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// function addComponentIdPreprocessor() {
//   return {
//     markup: ({ content, filename }) => {
//       // Get the component name from the filename
//       const componentName = path.basename(filename, '.svelte').toLowerCase();

//       // Skip processing if the file contains svelte:options
//       if (content.includes('<svelte:options')) {
//         console.log('Skipping svelte:options file:', filename);
//         return { code: content };
//       }

//       // Enhanced regex to catch more component patterns
//       const regex = /<(?!svelte:)([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)[^>]*?(?:>|\s)/;
//       const match = content.match(regex);

//       if (match) {
//         const originalTag = match[0];
//         const tagEnd = originalTag.endsWith('>') ? '>' : ' ';

//         // Check if the tag already has an id attribute
//         if (!originalTag.includes('id=')) {
//           // Handle cases where the tag might have other attributes
//           let newTag;
//           if (originalTag.includes(' ')) {
//             // If there are other attributes, insert ID before them
//             newTag = originalTag.replace(/^<([^\s>]+)/, `<$1 id="${componentName}"`);
//           } else {
//             // If it's a simple tag, add the ID
//             newTag = originalTag.replace(/>$/, ` id="${componentName}">`);
//           }

//           console.log('Original:', originalTag);
//           console.log('Modified:', newTag);

//           return {
//             code: content.replace(originalTag, newTag)
//           };
//         }
//       }

//       return { code: content };
//     }
//   };
// }

export default {
	preprocess: [vitePreprocess()],
};
export const AI_PROMPTS = {
  // 1. Title of Invention
  title: {
    prompt: (
      inventionText
    ) => `As a legal assistant, suggest a patent title reflecting the core novelty of the given invention. Do any necessary reasoning or brainstorming but do not include it in the final output. Final output: - A single title, max 15 words in the following JSON format:
{
  "content": "the actual title text here"
}
The invention text is: ${inventionText}`,
  },

  // 2. Abstract
  abstract: {
    prompt: (
      inventionText
    ) => `As a legal assistant, draft an 'Abstract' focusing mostly on the main invention concept. Do not mention any claim numbers or highlight claims directly. Your final output should: - Be max 100 words. - Start with: "Concepts and technologies disclosed herein are..." - Be a single paragraph.
Provide your output in the following JSON format:
{
  "content": "Concepts and technologies disclosed herein are..."
}
The invention text is: ${inventionText}`,
  },

  // 3. Field of Invention
  field: {
    prompt: (
      inventionText
    ) => `As a legal assistant, your task is to draft a "Field of the Invention" section for a patent. Your final output should: - There should be a single paragraph (no additional headings) where the technical field or the domain that the invention belongs to is written using multiple lines within the single paragraph only. The paragraph should start like "The invention belongs to...". Limit the final output to a maximum of 80 words.
Provide your output in the following JSON format:
{
  "content": "The invention belongs to..."
}
The invention text is: ${inventionText}`,
  },

  // 4. Background
  background: {
    prompt: (
      inventionText
    ) => `As a legal assistant, your task is to draft a 'Background' section for a patent. Do any necessary reasoning or brainstorming to understand the context, but do not include this reasoning in your final output. Your final output should:  - The background should be divided into 3-4 paragraphs (no additional headings). - The background should talk about the technology field of the invention and the prior art issues addressed. - Do not disclose the invention's key features. - Limit the final json output to a maximum of 350 words.
Provide your output in the following JSON format:
{
  "content": "Full background text with paragraphs combined"
}
The invention text is: ${inventionText}`,
  },

  // 5. Summary
  summary: {
    prompt: (
      inventionText
    ) => `As a legal assistant, your task is to draft a 'Summary' for a patent. Do any necessary reasoning or brainstorming to capture the essence of the invention, but do not include this reasoning in your final output. Your final output should: - Be a maximum of 150 words. Start with a small paragraph of around 50 words that captures the essence followed by several one-liner sentences starting with "Optionally, ...", as used in patents.
Make sure to use 1 or 2 paragraphs for the summary and no numbered line or anything to be there.
Provide your output in the following JSON format:
{
  "content": "Full summary text here"
}
The invention text is: ${inventionText}`,
  },

  // 6. Detailed Description
  description: {
    prompt: (
      inventionText
    ) => `As a legal assistant, create a 'Detailed Description' to support the invention. Do any necessary reasoning or brainstorming but exclude it from the final output. Your final output should: - Provide a thorough explanation in at least 800 words, focusing on quality. - Explain the invention in 7-8 paragraphs wherein you explain the invention using multiple embodiments – note that each embodiment must explain the main novelty of the invention in various ways (since each embodiment is itself a best mode to explain the invention). Provide a comprehensive description of the invention. How does it work? What are its components or steps?
There must be no additional headings.
Don't use Tables and images in the answer.
Don't use html word.
Provide a comprehensive description of the invention. How does it work? What are its components or steps? Refer to any drawings where necessary, explaining each part in detail.
And provided content should only give complete answer and the provided content must be left aligned.
Provide your output in the following JSON format:
{
  "content": "Full detailed description text here"
}
The invention text is: ${inventionText}`,
  },

  // 7. Advantages
  advantages: {
    prompt: (
      inventionText
    ) => `You are a researcher. Your task is to read the given invention details and then identify the advantages the invention offers over existing technologies. The advantages can be in terms of improved performance, efficiency, cost, or usability compared to the prior art, whichever is disclosed. While writing, please write the exact advantages written in the invention detail, do not add anything from your side. Try not to include any other details such as patent numbers or problem details or anything else, just the advantages being written in the invention details. Make the format such as a heading which is the advantage and then numbered line(s) below explaining the specific advantage of that and then the next advantage heading and then numbered line(s) below and so on. Also use up to 150 words to answer.
Provide your output in the following JSON format:
{
  "content": "Full advantages text here"
}
The invention text is: ${inventionText}`,
  },
};

/** Blueprint instance override projection for Card documents. */
import type {
    AdditionalFieldDefinitionMap,
    CardBlock,
    CardDocument,
    CardInstanceRecord,
} from './model'

function cloneAdditionalFieldDefinitions(
    fields: AdditionalFieldDefinitionMap | undefined,
): AdditionalFieldDefinitionMap | undefined {
    if (!fields) return undefined
    return Object.fromEntries(
        Object.entries(fields).map(([fieldKey, definition]) => [fieldKey, { ...definition }]),
    )
}

function mergeBlockOverride(block: CardBlock, instance: CardInstanceRecord): CardBlock {
    const overrides = instance.data[block.id] ?? {}
    const projected = Object.fromEntries(
        Object.entries(overrides).filter(([fieldKey]) => fieldKey !== 'additionalFieldDefinition'),
    )

    switch (block.type) {
        case 'text-block':
        case 'markdown-text-block':
            return {
                ...block,
                ...projected,
                additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
            }
        case 'image-block':
        case 'qrcode-block':
        case 'shape-block':
            return {
                ...block,
                ...projected,
                additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
            }
        case 'simple-container-block':
            return {
                ...block,
                ...projected,
                additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
                children: block.children.map((child) => ({
                    location: { ...child.location },
                    block: mergeBlockOverride(child.block, instance),
                })),
            }
        case 'flow-container-block':
            return {
                ...block,
                ...projected,
                additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
                children: block.children.map((child) => ({
                    location: { ...child.location },
                    block: mergeBlockOverride(child.block, instance),
                })),
            }
    }
}

export function applyInstance(
    document: CardDocument,
    instance: CardInstanceRecord | null,
): CardDocument {
    if (!instance) {
        return document
    }

    return {
        ...document,
        faces: {
            front: {
                ...document.faces.front,
                children: document.faces.front.children.map((child) => ({
                    location: { ...child.location },
                    block: mergeBlockOverride(child.block, instance),
                })),
            },
            back: {
                ...document.faces.back,
                children: document.faces.back.children.map((child) => ({
                    location: { ...child.location },
                    block: mergeBlockOverride(child.block, instance),
                })),
            },
        },
    }
}

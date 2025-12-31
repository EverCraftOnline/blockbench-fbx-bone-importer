(() => {
    var importAction;

    Plugin.register('import_bone_hierarchy', {
        title: 'Bone Hierarchy Importer',
        name: 'Bone Hierarchy Importer',
        icon: 'import_export',
        author: 'Hiddentree Entertainment Inc',
        description: 'Import bone hierarchy from JSON files exported from Unity',
        about: 'This plugin allows for the seamless import of bone hierarchies from JSON files, facilitating easier transitions between Unity and Blockbench. Ideal for animators and developers seeking to streamline their workflow. For more information and contributions, visit [GitHub repository](https://github.com/EverCraftOnline/blockbench-fbx-bone-importer).',
        version: '2.0.0',
        min_version: '5.0.0',
        variant: 'both',
        onload() {
            importAction = new Action('import_bone_hierarchy', {
                id: 'import_bone_hierarchy',
                name: 'Import Bone Hierarchy from JSON',
                description: 'Import bone hierarchy from a JSON file exported from Unity',
                icon: 'import_export',
                click: () => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.json';

                    fileInput.onchange = (event) => {
                        const file = event.target.files[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const boneHierarchy = JSON.parse(reader.result);
                                console.log('Parsed JSON data:', boneHierarchy);

                                Undo.initEdit({ outliner: true });
                                
                                const rootBone = createBlockbenchBone(boneHierarchy, [0, 0, 0], null);
                                
                                if (rootBone) {
                                    let added = false;
                                    
                                    if (Format.bedrock && Outliner) {
                                        try {
                                            const target = Outliner.ROOT || Outliner.root;
                                            if (target) {
                                                rootBone.addTo(target);
                                                added = true;
                                            }
                                        } catch (e) {
                                            console.warn('Failed to add to Outliner.ROOT/root:', e);
                                        }
                                    }
                                    
                                    if (!added && Format.java && Group && Group.all && Group.all.length > 0) {
                                        try {
                                            rootBone.addTo(Group.all[0]);
                                            added = true;
                                        } catch (e) {
                                            console.warn('Failed to add to Group.all[0]:', e);
                                        }
                                    }
                                    
                                    if (!added && Outliner) {
                                        try {
                                            const target = Outliner.ROOT || Outliner.root;
                                            if (target) {
                                                rootBone.addTo(target);
                                                added = true;
                                            } else {
                                                rootBone.addTo();
                                                added = true;
                                            }
                                        } catch (e) {
                                            console.error('Failed to add bone:', e);
                                            try {
                                                rootBone.addTo();
                                                added = true;
                                            } catch (e2) {
                                                console.error('Failed to add bone without parent:', e2);
                                            }
                                        }
                                    }
                                    
                                    Undo.finishEdit('Import Bone Hierarchy');
                                    
                                    if (added) {
                                        try {
                                            if (Canvas && typeof Canvas.updateAll === 'function') {
                                                Canvas.updateAll();
                                            }
                                            if (Outliner && typeof Outliner.updateSelection === 'function') {
                                                Outliner.updateSelection();
                                            }
                                        } catch (updateError) {
                                            console.warn('Error updating canvas/outliner:', updateError);
                                        }
                                        Blockbench.showQuickMessage('Bone hierarchy imported successfully!', 2000);
                                    } else {
                                        Blockbench.showMessageBox({
                                            title: 'Warning',
                                            message: 'Bone hierarchy created but could not be added to outliner.',
                                            icon: 'warning'
                                        });
                                    }
                                } else {
                                    Undo.finishEdit('Import Bone Hierarchy');
                                }
                            } catch (error) {
                                console.error('Error importing bone hierarchy:', error);
                                Blockbench.showMessageBox({
                                    title: 'Import Error',
                                    message: `Failed to import bone hierarchy: ${error.message}`,
                                    icon: 'error'
                                });
                            }
                        };

                        reader.readAsText(file);
                    };
                    fileInput.click();
                }
            });
            MenuBar.addAction(importAction, 'tools.0');
        },
        onunload() {
            importAction.delete();
        },
    });
})();

function createBlockbenchBone(boneNode, worldPosition = [0, 0, 0], parentBone = null) {
    try {
        if (!boneNode) {
            console.warn('Bone node is null or undefined');
            return null;
        }
        
        if (typeof boneNode !== 'object') {
            console.warn('Bone node is not an object:', typeof boneNode, boneNode);
            return null;
        }
        
        if (!boneNode.name) {
            console.warn('Bone node missing name property:', boneNode);
            return null;
        }

        const localPosition = [
            (boneNode.position && typeof boneNode.position === 'object' && boneNode.position.x !== undefined) ? boneNode.position.x : 0,
            (boneNode.position && typeof boneNode.position === 'object' && boneNode.position.y !== undefined) ? boneNode.position.y : 0,
            (boneNode.position && typeof boneNode.position === 'object' && boneNode.position.z !== undefined) ? boneNode.position.z : 0
        ];
        
        const rotation = [
            (boneNode.rotation && typeof boneNode.rotation === 'object' && boneNode.rotation.x !== undefined) ? boneNode.rotation.x : 0,
            (boneNode.rotation && typeof boneNode.rotation === 'object' && boneNode.rotation.y !== undefined) ? boneNode.rotation.y : 0,
            (boneNode.rotation && typeof boneNode.rotation === 'object' && boneNode.rotation.z !== undefined) ? boneNode.rotation.z : 0
        ];

        const boneStart = [...worldPosition];
        const boneEnd = [
            boneStart[0] + localPosition[0],
            boneStart[1] + localPosition[1],
            boneStart[2] + localPosition[2]
        ];

        const boneLength = Math.sqrt(
            Math.pow(boneEnd[0] - boneStart[0], 2) +
            Math.pow(boneEnd[1] - boneStart[1], 2) +
            Math.pow(boneEnd[2] - boneStart[2], 2)
        );

        let finalBoneEnd = [...boneEnd];
        
        if (boneLength < 0.001) {
            const childrenArray = (boneNode.hasOwnProperty('children') && Array.isArray(boneNode.children)) ? boneNode.children : null;
            if (childrenArray && childrenArray.length > 0) {
                const firstChild = childrenArray[0];
                if (firstChild && typeof firstChild === 'object' && firstChild !== null && firstChild.hasOwnProperty('position')) {
                    const childPos = [
                        (firstChild.position && typeof firstChild.position === 'object' && firstChild.position.x !== undefined) ? firstChild.position.x : 0,
                        (firstChild.position && typeof firstChild.position === 'object' && firstChild.position.y !== undefined) ? firstChild.position.y : 0,
                        (firstChild.position && typeof firstChild.position === 'object' && firstChild.position.z !== undefined) ? firstChild.position.z : 0
                    ];
                    finalBoneEnd = [
                        boneStart[0] + localPosition[0] + childPos[0],
                        boneStart[1] + localPosition[1] + childPos[1],
                        boneStart[2] + localPosition[2] + childPos[2]
                    ];
                } else {
                    const defaultLength = 0.1;
                    finalBoneEnd = [
                        boneStart[0],
                        boneStart[1] + defaultLength,
                        boneStart[2]
                    ];
                }
            } else {
                const defaultLength = 0.1;
                finalBoneEnd = [
                    boneStart[0],
                    boneStart[1] + defaultLength,
                    boneStart[2]
                ];
            }
        }

        const bbBone = new Group({
            name: String(boneNode.name),
            origin: boneStart,
            from: boneStart,
            to: finalBoneEnd,
            rotation: rotation,
            pivot: boneStart
        });

        const childWorldPosition = [
            boneStart[0] + localPosition[0],
            boneStart[1] + localPosition[1],
            boneStart[2] + localPosition[2]
        ];

        const childrenArray = (boneNode.hasOwnProperty('children') && Array.isArray(boneNode.children)) ? boneNode.children : null;
        if (childrenArray && childrenArray.length > 0) {
            for (let index = 0; index < childrenArray.length; index++) {
                const child = childrenArray[index];
                try {
                    if (child && typeof child === 'object' && child !== null && !Array.isArray(child)) {
                        const bbChild = createBlockbenchBone(child, childWorldPosition, bbBone);
                        if (bbChild && bbChild !== null) {
                            bbChild.addTo(bbBone);
                        }
                    } else {
                        console.warn(`Skipping invalid child at index ${index} of bone "${boneNode.name}":`, child);
                    }
                } catch (childError) {
                    console.error(`Error processing child at index ${index} of bone "${boneNode.name}":`, childError);
                    console.error('Child object:', child);
                }
            }
        }

        if (parentBone && parentBone !== null) {
            bbBone.addTo(parentBone);
        }

        return bbBone;
    } catch (error) {
        console.error(`Error creating bone "${(boneNode && boneNode.name) ? boneNode.name : 'unknown'}":`, error);
        console.error('Bone node data:', boneNode);
        return null;
    }
}
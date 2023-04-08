(() => {
    var importAction;

    Plugin.register('import_bone_hierarchy', {
        name: 'Bone Hierarchy Importer',
        icon: 'import_export', // Replace 'icon' with an icon file or a Material Icons name
        author: 'h1ddentree productions',
        description: 'Import bone hierarchy from JSON files',
        version: '1.0.0',
        min_version: '3.0.0',
        variant: 'both',
        onload() {
            importAction = new Action('import_bone_hierarchy', {
            name: 'Import Bone Hierarchy from JSON',
            description: 'Import bone hierarchy from a JSON file',
            icon: 'import_export', // Replace 'icon' with an icon file or a Material Icons name
            click: () => {
                    // Create file input element
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.json';

                    fileInput.onchange = (event) => {
                        // Load JSON file
                        const file = event.target.files[0];
                        const reader = new FileReader();

                        reader.onload = (event) => {
                            const boneHierarchy = JSON.parse(reader.result);
                            const rootBone = createBlockbenchBone(boneHierarchy);
                            rootBone.addTo(); // Add root bone to the scene without any parameter
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


function createBlockbenchBone(boneNode) {
    // Create a Blockbench bone from a bone node
    const bbBone = new Group({
        name: boneNode.name,
        origin: boneNode.position,
        rotation: boneNode.rotation,
        extend: boneNode.scale,
        pivot: boneNode.position 
    });

    // Process and add children
    if (boneNode.children) {
        boneNode.children.forEach(child => {
            const bbChild = createBlockbenchBone(child);
            bbChild.addTo(bbBone);
        });
    }

    return bbBone;
};

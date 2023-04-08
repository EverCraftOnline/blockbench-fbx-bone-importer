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
                            console.log('Parsed JSON data:', boneHierarchy);
                            const rootBone = createBlockbenchBone(boneHierarchy);
                            rootBone.addTo(Group.selected);
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

function createBlockbenchBone(boneNode, parentPivot = [0, 0, 0], parentBone = null) {
    // Convert position, rotation, and scale objects to arrays
    const positionArray = [boneNode.position.x, boneNode.position.y, boneNode.position.z];
    const rotationArray = [boneNode.rotation.x, boneNode.rotation.y, boneNode.rotation.z];
    // const scaleArray = [boneNode.scale.x, boneNode.scale.y, boneNode.scale.z];

    // Calculate the bone's position relative to its parent
    const positionRelativeToParent = [
        parentPivot[0] + positionArray[0],
        parentPivot[1] + positionArray[1],
        parentPivot[2] + positionArray[2],
    ];

    // Create a Blockbench bone from a bone node
    const bbBone = new Group({
        name: boneNode.name,
        origin: positionRelativeToParent,
        rotation: rotationArray,
        // extend: scaleArray
    });

    if(parentBone) {
        bbBone.parent = parentBone;
    }

    // Process and add children
    if (boneNode.children) {
        boneNode.children.forEach((child) => {
            const bbChild = createBlockbenchBone(child, positionRelativeToParent, boneNode);
            bbChild.addTo(bbBone);
        });
    }

    return bbBone;
}
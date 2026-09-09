(() => {
    let rotateToggle;
    const originals = {};

    // Blockbench's own rotateImageDataByDegrees() is private to js/uv/uv.js, so
    // we need our own 90-degree-only rotator for the mesh UV path.
    function rotateOnce90(src) {
        let w = src.width, h = src.height;
        let dst = new ImageData(h, w);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let si = (y * w + x) * 4;
                let dx = h - 1 - y;
                let dy = x;
                let di = (dy * h + dx) * 4;
                dst.data[di] = src.data[si];
                dst.data[di + 1] = src.data[si + 1];
                dst.data[di + 2] = src.data[si + 2];
                dst.data[di + 3] = src.data[si + 3];
            }
        }
        return dst;
    }
    function rotateImageData90(imageData, steps) {
        steps = ((steps % 4) + 4) % 4;
        let data = imageData;
        for (let i = 0; i < steps; i++) data = rotateOnce90(data);
        return data;
    }

    function getMeshFaceUVBBox(face) {
        let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
        face.vertices.forEach(vkey => {
            let uv = face.uv[vkey];
            if (!uv) return;
            min_x = Math.min(min_x, uv[0]); max_x = Math.max(max_x, uv[0]);
            min_y = Math.min(min_y, uv[1]); max_y = Math.max(max_y, uv[1]);
        });
        return [min_x, min_y, max_x, max_y];
    }

    // Same UV-space -> texture-pixel-space conversion Blockbench's own
    // mirrorX/mirrorY use, so the region lines up with what the UV editor shows.
    function pixelRectFromUVBBox(bbox, texture) {
        let factor_x = texture.width / UVEditor.getUVWidth();
        let factor_y = texture.height / UVEditor.getUVHeight();
        let x = Math.floor(bbox[0] * factor_x);
        let y = Math.floor(bbox[1] * factor_y);
        let w = Math.ceil((bbox[2] - bbox[0]) * factor_x) || 1;
        let h = Math.ceil((bbox[3] - bbox[1]) * factor_y) || 1;
        x = Math.max(0, Math.min(x, texture.width - 1));
        y = Math.max(0, Math.min(y, texture.height - 1));
        w = Math.max(1, Math.min(w, texture.width - x));
        h = Math.max(1, Math.min(h, texture.height - y));
        return {x, y, w, h};
    }

    function unionRect(a, b) {
        let x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
        let x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
        return {x: x1, y: y1, w: x2 - x1, h: y2 - y1};
    }

    // Compares a mesh face's UV vertices before/after a drag and returns how many
    // 90-degree clockwise steps were applied (0-3), or 0 if the change wasn't a
    // clean ~90-multiple rotation (e.g. a free-angle drag) or was negligible.
    function detectFaceRotationSteps(face, beforeUv) {
        let vkeys = face.vertices.filter(vkey => beforeUv[vkey] && face.uv[vkey]);
        if (vkeys.length < 2) return 0;
        function centroid(src) {
            let sx = 0, sy = 0;
            vkeys.forEach(vkey => { sx += src[vkey][0]; sy += src[vkey][1]; });
            return [sx / vkeys.length, sy / vkeys.length];
        }
        let beforeCenter = centroid(beforeUv);
        let afterCenter = centroid(face.uv);
        let sumSin = 0, sumCos = 0, n = 0;
        vkeys.forEach(vkey => {
            let bx = beforeUv[vkey][0] - beforeCenter[0], by = beforeUv[vkey][1] - beforeCenter[1];
            let ax = face.uv[vkey][0] - afterCenter[0], ay = face.uv[vkey][1] - afterCenter[1];
            let bLen = Math.sqrt(bx * bx + by * by), aLen = Math.sqrt(ax * ax + ay * ay);
            if (bLen < 1e-4 || aLen < 1e-4) return;
            let diff = Math.atan2(ay, ax) - Math.atan2(by, bx);
            sumSin += Math.sin(diff); sumCos += Math.cos(diff); n++;
        });
        if (!n) return 0;
        let meanAngleDeg = Math.atan2(sumSin, sumCos) * 180 / Math.PI;
        meanAngleDeg = ((meanAngleDeg % 360) + 360) % 360;
        let steps = Math.round(meanAngleDeg / 90) % 4;
        let nearest90 = steps * 90;
        let delta = Math.min(Math.abs(meanAngleDeg - nearest90), 360 - Math.abs(meanAngleDeg - nearest90));
        if (steps === 0 || delta > 10) return 0;
        return steps;
    }

    function collectMeshEntries() {
        let entries = [];
        Mesh.selected.forEach(mesh => {
            mesh.getSelectedFaces().forEach(fkey => {
                let face = mesh.faces[fkey];
                if (!face || face.vertices.length < 3) return;
                let texture = face.getTexture();
                if (!texture || !texture.ctx) return;
                entries.push({face, texture, oldRect: pixelRectFromUVBBox(getMeshFaceUVBBox(face), texture)});
            });
        });
        return entries;
    }

    function rotateMeshEntriesBySteps(entries, steps) {
        if (!entries.length || !steps) return;
        let textures = Array.from(new Set(entries.map(e => e.texture)));
        entries.forEach(e => {
            let newRect = pixelRectFromUVBBox(getMeshFaceUVBBox(e.face), e.texture);
            let rotated = rotateImageData90(e.pixels, steps);
            let clear = unionRect(e.oldRect, newRect);
            e.texture.ctx.clearRect(clear.x, clear.y, clear.w, clear.h);
            e.texture.ctx.putImageData(rotated, newRect.x, newRect.y);
        });
        textures.forEach(t => t.updateChangesAfterEdit());
    }

    // Entry point 1: the "Rotate UV Left/Right" menu actions (UV menu, fixed 90-degree steps).
    function handleMeshMenuRotate(angle, event, original_click, context) {
        if (!rotateToggle.value) {
            return original_click.call(context, event);
        }
        let entries = collectMeshEntries();
        if (!entries.length) {
            return original_click.call(context, event);
        }
        entries.forEach(e => {
            e.pixels = e.texture.ctx.getImageData(e.oldRect.x, e.oldRect.y, e.oldRect.w, e.oldRect.h);
        });
        let textures = Array.from(new Set(entries.map(e => e.texture)));
        let steps = ((angle / 90) % 4 + 4) % 4;

        Undo.initEdit({elements: Mesh.selected, uv_only: true, bitmap: true, textures});
        UVEditor.rotate(angle);
        rotateMeshEntriesBySteps(entries, steps);
        Undo.finishEdit('Rotate UV ' + (angle < 0 ? 'left' : 'right'));
    }

    Plugin.register('uv_rotation_lock', {
        title: 'UV Rotation Lock',
        name: 'UV Rotation Lock',
        icon: 'autorenew',
        author: 'Hiddentree Entertainment Inc',
        description: 'Rotates the texture together with a face\'s UV, the same way "Move Texture with UV" keeps them together while dragging.',
        about: 'Adds a "Rotate Texture with UV" toggle next to "Move Texture with UV" in the UV editor. With it on, rotating a face\'s UV — via the rotate handle in the UV editor, the "Rotate UV Left/Right" menu items, or the cube face rotation control — rotates the underlying texture pixels to match instead of leaving them in place. Works independently of the native "Move Texture with UV" toggle, for both Box UV cubes and meshes.',
        version: '1.1.0',
        min_version: '4.10.0',
        variant: 'both',
        onload() {
            // Defend against being loaded again without every previous copy being
            // unloaded first (e.g. re-loading the plugin file from disk repeatedly) -
            // that leaves orphaned toggle buttons behind, since BarItems only ever
            // points at the latest one while the toolbar keeps direct references to
            // all of them. Purge every stale copy by id before adding a fresh one.
            if (Toolbars.uv_editor) {
                Toolbars.uv_editor.children.slice().forEach(item => {
                    if (item && item.id === 'rotate_texture_with_uv') {
                        Toolbars.uv_editor.remove(item);
                    }
                });
            }
            if (BarItems.rotate_texture_with_uv) {
                try { BarItems.rotate_texture_with_uv.delete(); } catch (e) {}
            }

            rotateToggle = new Toggle('rotate_texture_with_uv', {
                name: 'Rotate Texture with UV',
                description: 'Rotate the texture together with UV rotation',
                icon: 'fas.fa-sync-alt',
                category: 'uv',
                condition: {modes: ['edit']},
                save_on_restart: true,
            });

            if (Toolbars.uv_editor) {
                Toolbars.uv_editor.add(rotateToggle);
            }

            // Entry point: the drag-to-rotate handle in the UV editor (UVEditor.vue.rotateFace).
            // This is the primary way users rotate a face's UV, and Blockbench itself only
            // ever wires texture-following into it for Cube faces (gated behind the native
            // "Move Texture with UV" toggle) - Mesh faces get no pixel handling here at all.
            if (UVEditor.vue && typeof UVEditor.vue.rotateFace === 'function') {
                originals.rotateFace = UVEditor.vue.rotateFace;
                UVEditor.vue.rotateFace = function (event) {
                    if (!rotateToggle.value) {
                        return originals.rotateFace.call(this, event);
                    }

                    // Reuse Blockbench's own already-correct cube pixel-rotation logic by
                    // momentarily forcing its native toggle on for this interaction.
                    let forced_native = false;
                    if (BarItems.move_texture_with_uv && !BarItems.move_texture_with_uv.value) {
                        BarItems.move_texture_with_uv.value = true;
                        forced_native = true;
                    }

                    // Snapshot mesh faces before the drag starts; the native function has
                    // no bitmap tracking for mesh, so we handle that ourselves afterward.
                    let meshEntries = [];
                    UVEditor.getMappableElements().forEach(element => {
                        if (!(element instanceof Mesh)) return;
                        UVEditor.getSelectedFaces(element).forEach(fkey => {
                            let face = element.faces[fkey];
                            if (!face || face.vertices.length < 3) return;
                            let texture = face.getTexture();
                            if (!texture || !texture.ctx) return;
                            let beforeUv = {};
                            face.vertices.forEach(vkey => {
                                if (face.uv[vkey]) beforeUv[vkey] = face.uv[vkey].slice();
                            });
                            meshEntries.push({
                                face, texture, beforeUv,
                                oldRect: pixelRectFromUVBBox(getMeshFaceUVBBox(face), texture),
                            });
                        });
                    });
                    meshEntries.forEach(e => {
                        e.pixels = e.texture.ctx.getImageData(e.oldRect.x, e.oldRect.y, e.oldRect.w, e.oldRect.h);
                    });

                    function onDragEnd() {
                        document.removeEventListener('mouseup', onDragEnd);
                        document.removeEventListener('touchend', onDragEnd);

                        if (forced_native) {
                            BarItems.move_texture_with_uv.value = false;
                            forced_native = false;
                        }

                        if (!meshEntries.length) return;

                        let touched = meshEntries.map(e => {
                            let steps = detectFaceRotationSteps(e.face, e.beforeUv);
                            return steps ? {e, steps} : null;
                        }).filter(Boolean);
                        if (!touched.length) return;

                        let textures = Array.from(new Set(touched.map(t => t.e.texture)));
                        Undo.initEdit({elements: Mesh.selected, uv_only: true, bitmap: true, textures});
                        touched.forEach(({e, steps}) => rotateMeshEntriesBySteps([e], steps));
                        Undo.finishEdit('Rotate texture with UV');
                    }

                    let result = originals.rotateFace.call(this, event);
                    // Registered after the native handler's own mouseup listener, so that
                    // listener (which finalizes the UV-only undo step) runs first.
                    document.addEventListener('mouseup', onDragEnd);
                    document.addEventListener('touchend', onDragEnd);
                    return result;
                };
            }

            // Entry point: the numeric 0/90/180/270 rotation control for Box UV cube faces.
            if (BarItems.uv_rotation) {
                originals.onBefore = BarItems.uv_rotation.onBefore;
                originals.onAfter = BarItems.uv_rotation.onAfter;
                let forced_native_slider = false;

                BarItems.uv_rotation.onBefore = function (...args) {
                    if (rotateToggle.value && BarItems.move_texture_with_uv && !BarItems.move_texture_with_uv.value) {
                        BarItems.move_texture_with_uv.value = true;
                        forced_native_slider = true;
                    }
                    return originals.onBefore.apply(this, args);
                };
                BarItems.uv_rotation.onAfter = function (...args) {
                    let result = originals.onAfter.apply(this, args);
                    if (forced_native_slider) {
                        BarItems.move_texture_with_uv.value = false;
                        forced_native_slider = false;
                    }
                    return result;
                };
            }

            // Entry point: the "Rotate UV Left/Right" items in the UV menu (Mesh only).
            if (BarItems.uv_rotate_left) {
                originals.rotate_left_click = BarItems.uv_rotate_left.click;
                BarItems.uv_rotate_left.click = function (event) {
                    handleMeshMenuRotate(-90, event, originals.rotate_left_click, this);
                };
            }
            if (BarItems.uv_rotate_right) {
                originals.rotate_right_click = BarItems.uv_rotate_right.click;
                BarItems.uv_rotate_right.click = function (event) {
                    handleMeshMenuRotate(90, event, originals.rotate_right_click, this);
                };
            }
        },
        onunload() {
            if (UVEditor.vue && originals.rotateFace) {
                UVEditor.vue.rotateFace = originals.rotateFace;
            }
            if (BarItems.uv_rotation && originals.onBefore) {
                BarItems.uv_rotation.onBefore = originals.onBefore;
                BarItems.uv_rotation.onAfter = originals.onAfter;
            }
            if (BarItems.uv_rotate_left && originals.rotate_left_click) {
                BarItems.uv_rotate_left.click = originals.rotate_left_click;
            }
            if (BarItems.uv_rotate_right && originals.rotate_right_click) {
                BarItems.uv_rotate_right.click = originals.rotate_right_click;
            }
            if (rotateToggle) rotateToggle.delete();
        },
    });
})();

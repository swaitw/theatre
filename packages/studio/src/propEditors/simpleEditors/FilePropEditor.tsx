import type {PropTypeConfig_File} from '@theatre/core/types/public'
import {Package, Trash} from '@theatre/studio/uiComponents/icons'
import React, {useCallback, useEffect} from 'react'
import styled, {css} from 'styled-components'
import type {ISimplePropEditorReactProps} from './ISimplePropEditorReactProps'
import type {$FixMe} from '@theatre/core/types/public'

const Container = styled.div<{empty: boolean}>`
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
`

const AddFile = styled.div`
  position: absolute;
  inset: -5px;
  // rotate 45deg
  transform: rotate(45deg);
  --checker-color: #ededed36;
  &:hover {
    --checker-color: #ededed77;
  }
  // checkerboard background with 4px squares
  background-image: linear-gradient(
      45deg,
      var(--checker-color) 25%,
      transparent 25%
    ),
    linear-gradient(-45deg, var(--checker-color) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--checker-color) 75%),
    linear-gradient(-45deg, transparent 75%, var(--checker-color) 75%);
  background-size: 5px 5px;
`

const InputLabel = styled.label<{empty: boolean}>`
  position: relative;
  cursor: default;
  box-sizing: border-box;

  height: 18px;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;

  overflow: hidden;
  color: #ccc;
  &:hover {
    color: white;
  }

  border-radius: 99999px;
  border: 1px solid hwb(220deg 40% 52%);
  &:hover {
    border-color: hwb(220deg 45% 52%);
  }

  ${(props) => (props.empty ? css`` : css``)}
`

// file input
const Input = styled.input.attrs({type: 'file'})`
  display: none;
`

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  background: transparent;
  color: #a8a8a9;

  border: none;
  height: 100%;
  aspect-ratio: 1/1;

  opacity: 0;

  ${Container}:hover & {
    opacity: 0.8;
  }

  &:hover {
    opacity: 1;
    color: white;
  }
`

function FilePropEditor({
  propConfig,
  editingTools,
  value,
  autoFocus,
}: ISimplePropEditorReactProps<PropTypeConfig_File>) {
  const [previewUrl, setPreviewUrl] = React.useState<string>()

  useEffect(() => {
    if (value) {
      setPreviewUrl(editingTools.getAssetUrl(value))
    } else {
      setPreviewUrl(undefined)
    }
  }, [value])

  const onChange = useCallback(
    async (event: React.ChangeEvent<$FixMe>) => {
      const file = event.target.files[0]
      editingTools.permanentlySetValue({type: 'file', id: undefined})
      const fileId = await editingTools.createAsset(file)

      if (!fileId) {
        editingTools.permanentlySetValue(value)
      } else {
        editingTools.permanentlySetValue({
          type: 'file',
          id: fileId,
        })
      }
      event.target.value = null
    },
    [editingTools, value],
  )

  const empty = !value?.id

  return (
    <Container empty={empty}>
      <InputLabel
        empty={empty}
        title={
          empty ? 'Upload file' : `"${value.id}" (Click to upload new file)`
        }
      >
        <Input type="file" onChange={onChange} autoFocus={autoFocus} />
        {previewUrl ? <Package /> : <AddFile />}
      </InputLabel>

      {!empty && (
        <DeleteButton
          title="Delete file"
          onClick={() => {
            editingTools.permanentlySetValue({type: 'file', id: undefined})
          }}
        >
          <Trash />
        </DeleteButton>
      )}
    </Container>
  )
}

export default FilePropEditor

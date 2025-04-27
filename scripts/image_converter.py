import pandas as pd
import base64
import os
import argparse
from urllib.parse import urlparse
from pathlib import Path
import mimetypes

def is_file_path_or_url(value):
    """Check if the value is a file path or URL."""
    if not isinstance(value, str):
        return False
    
    # Check if it's a URL
    try:
        result = urlparse(value)
        if all([result.scheme, result.netloc]):
            return True
    except:
        pass
    
    # Check if it's a file path
    return os.path.isfile(value)

def get_file_mime_type(file_path):
    """Determine the MIME type of a file."""
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        # Default to a generic binary type if we can't determine
        mime_type = 'application/octet-stream'
    return mime_type

def image_to_base64(file_path):
    """Convert an image file to a base64 data URI."""
    try:
        with open(file_path, 'rb') as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            mime_type = get_file_mime_type(file_path)
            return f"data:{mime_type};base64,{encoded_string}"
    except Exception as e:
        print(f"Error processing image {file_path}: {e}")
        return file_path  # Return original path if there's an error

def process_csv(input_file, output_file, image_col='Image'):
    """Process a CSV file, converting images in the specified column to base64."""
    try:
        # Read the CSV file
        df = pd.read_csv(input_file)
        
        # Check if the image column exists
        if image_col not in df.columns:
            print(f"Column '{image_col}' not found in the CSV. Available columns: {df.columns.tolist()}")
            return False
        
        # Process each row
        input_dir = os.path.dirname(os.path.abspath(input_file))
        
        # Function to process each cell in the image column
        def process_cell(cell_value):
            if pd.isna(cell_value) or not isinstance(cell_value, str) or cell_value.strip() == '':
                return cell_value
                
            # If it's already a data URI, leave it as is
            if isinstance(cell_value, str) and cell_value.startswith('data:'):
                return cell_value
                
            # If it's a relative path, make it absolute
            if isinstance(cell_value, str) and not os.path.isabs(cell_value) and not cell_value.startswith(('http://', 'https://')):
                cell_value = os.path.join(input_dir, cell_value)
                
            # Check if it's a file path or URL
            if is_file_path_or_url(cell_value):
                # Only process if it's a file (not a URL)
                if os.path.isfile(cell_value):
                    return image_to_base64(cell_value)
            
            return cell_value
        
        # Apply the processing function to the image column
        df[image_col] = df[image_col].apply(process_cell)
        
        # Save the processed data to a new CSV file
        df.to_csv(output_file, index=False)
        print(f"Processed CSV saved to {output_file}")
        return True
        
    except Exception as e:
        print(f"Error processing CSV: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Process a CSV file to convert images to base64.')
    parser.add_argument('input_file', help='Input CSV file path')
    parser.add_argument('-o', '--output_file', help='Output CSV file path')
    parser.add_argument('-c', '--column', default='Image', help='Column name containing image paths (default: "Image")')
    
    args = parser.parse_args()
    
    # If output file is not specified, create one based on the input file
    if not args.output_file:
        input_path = Path(args.input_file)
        output_path = input_path.with_name(f"{input_path.stem}_processed{input_path.suffix}")
        args.output_file = str(output_path)
    
    process_csv(args.input_file, args.output_file, args.column)

if __name__ == "__main__":
    main()